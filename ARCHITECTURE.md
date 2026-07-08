# 아키텍처

## 제품 목표

Drop AI v3의 목표는 command-first 구조 자체를 증명하는 것이 아니라, 브라우저에서 실제로 작동하는 lightweight DAW를 만드는 것이다.

사용자는 오디오 파일을 업로드하고, 재생하고, region을 편집하고, 결과를 WAV로 export할 수 있어야 한다. command-first 구조는 이 목표를 돕는 내부 설계 원칙이다. UI, CLI, keyboard shortcut, automation, plugin 같은 입력 경로가 늘어나도 같은 편집 코어를 공유하게 하기 위한 장치다.

## 입력 경로 단일화

DAW는 입력 경로가 빨리 늘어난다. React UI 버튼, CLI 문자열, 키보드 단축키, 자동화 command, 테스트 replay가 모두 같은 편집 의도를 만들 수 있다. 각 경로가 controller 세부 메서드를 직접 호출하면 같은 의도라도 검증, 분기, side effect 순서가 달라진다.

따라서 모든 쓰기 입력은 `AppController.executeCommand(rawCommand)`라는 하나의 진입점을 통과한다. raw command는 Zod로 검증되고, `CommandController`가 도메인별 controller로 분기한다.

```txt
Apps (Web UI · CLI · Keyboard · Test)
  -> AppController.executeCommand(rawCommand)
    -> CommandController (Zod validation + dispatch)
      -> PlaybackController       -> IAudioEngine + SessionStore
      -> AssetController          -> IAudioEngine
      -> TrackController          -> IAudioEngine + SessionStore
      -> SessionExportController  -> IAudioEngine + SessionStore
```

## 레이어 책임

### Apps

`apps`는 사용자의 입력을 command로 바꾸고, 읽기 전용 session snapshot을 화면에 보여준다. React 컴포넌트와 CLI는 session operation, writable store, Tone.js를 직접 알지 않는다.

### Controllers

`controllers`는 command 실행의 조율 지점이다. session state 변경과 audio engine side effect가 함께 필요한 작업은 controller에서 묶는다. 예를 들어 region을 추가하면 session state에도 region이 생겨야 하고, audio engine에도 실제 region player가 생겨야 한다.

### Session

`session`은 UI가 신뢰하는 편집 상태의 원본이다. track, region, playback처럼 화면에 반영되어야 하는 상태는 audio engine 내부 상태가 아니라 session state에 기록한다.

### Audio Engine

`audio-engine`은 실제 오디오 구현을 감싼다. controller는 `IAudioEngine`만 알며, Tone.js 같은 구체 라이브러리는 audio engine 내부에 격리한다.

제품 실행 경로에서는 `ToneAudioEngine`이 기본 구현이 되어야 한다. `FakeAudioEngine`은 테스트와 격리된 개발 확인에 사용한다.

### Composition

`composition`은 객체 생성과 의존성 조립만 담당한다. session store, audio engine, id generator, controller를 만들고 연결한다. 앱 로직은 composition에 두지 않는다.

## 레이어 규칙

- `tone` import는 `audio-engine/tone` 내부에서만 허용한다.
- React 컴포넌트는 controller와 읽기 전용 session reader를 통해서만 도메인에 접근한다.
- UI 이벤트 핸들러는 controller 세부 메서드를 직접 부르지 않고 `controller.executeCommand({ type: ... })`를 호출한다.
- Apps는 writable session store를 직접 import하지 않는다.
- UI에 반영되어야 하는 상태는 반드시 session state에 업데이트한다.
- Audio engine 내부 상태만 바꾸는 작업은 사용자에게 보이는 state change로 간주하지 않는다.
- 객체 생성과 기본 의존성 선택은 composition root에서 한다.

## 핵심 결정

### 1. Command-first는 제품 목표가 아니라 내부 계약이다

사용자는 command-first라는 말을 신경 쓰지 않는다. 사용자는 오디오가 재생되고, 편집이 반영되고, export 파일이 열리기를 기대한다.

그럼에도 command-first를 유지하는 이유는 입력 경로가 늘어났을 때 제품 동작을 일관되게 유지하기 위해서다. 새 UI 버튼이나 자동화 action을 만들 때 도메인 controller를 새로 우회하지 않고 command를 만들어 기존 실행 경계에 넣는다.

### 2. Asset은 region과 분리한다

오디오 파일은 asset으로 등록되어 `assetId`를 받는다. region은 파일을 직접 들고 있지 않고 `assetId`만 참조한다.

- 같은 파일을 여러 region에서 재사용할 수 있다.
- session state를 직렬화하기 쉽다.
- 나중에 프로젝트 저장/복원을 추가할 때 asset metadata와 binary blob을 분리할 수 있다.
- UI 드래그앤드롭은 `asset.register` -> `track.add` -> `region.add` 순서로 command를 발행한다.

### 3. Session state를 UI의 진실로 둔다

Tone.js나 WebAudio node 상태는 UI가 직접 관찰하기 어렵다. 그래서 화면에 보여야 하는 정보는 session state에 둔다. audio engine은 실제 재생과 export를 담당하지만, 사용자가 보는 편집 상태의 원본은 session이다.

이 선택은 session과 audio engine 상태를 함께 맞춰야 하는 비용을 만든다. 그 비용은 controller 테스트와 architecture boundary test로 관리한다.

### 4. 실제 오디오를 우선한다

현재 가장 중요한 다음 단계는 `ToneAudioEngine`을 기본 Web composition에 연결하는 것이다. command/session 흐름이 아무리 깨끗해도 실제 파일이 재생되지 않으면 제품은 작동하지 않는다.

따라서 앞으로의 구현 판단은 "구조가 더 순수한가"보다 "사용자가 실제 오디오 작업을 끝낼 수 있는가"를 우선한다. 단, 그 과정에서 command boundary와 session/audio engine 분리를 깨지 않는다.

## Persistence 방향

프로젝트 저장/복원은 더 이상 영구적인 non-goal이 아니다. 작동하는 DAW가 되기 위해 필요한 기능이다. 다만 현재 코드는 먼저 실제 재생/export vertical slice를 완성해야 한다.

Persistence가 들어오면 별도 controller와 repository adapter를 둘 수 있다.

```txt
session.save / session.load
  -> SessionPersistenceController
    -> ISessionRepository
    -> SessionStore
```

저장소는 IndexedDB부터 시작하는 것이 자연스럽다. region은 `assetId`를 참조하고, asset metadata와 blob은 별도 저장소에서 관리한다.

## 트레이드오프

이 구조는 작은 기능을 빠르게 붙이는 데는 다소 무겁다. 새 command를 추가하려면 schema, command result, controller dispatch, CLI parser, 테스트를 함께 봐야 한다.

대신 다음 이점을 얻는다.

- UI와 CLI가 같은 실행 경계를 공유한다.
- 잘못된 payload는 실행 전에 한 번에 걸린다.
- session state가 plain object라 테스트와 저장/복원이 쉽다.
- Tone.js 의존성이 앱 전체로 번지지 않는다.
- 실제 오디오 구현을 바꾸거나 보강할 수 있다.

현재 목표에서는 이 구조를 "검증 대상"으로 보지 않는다. 작동하는 DAW를 안정적으로 키우기 위한 기본 안전장치로 본다.

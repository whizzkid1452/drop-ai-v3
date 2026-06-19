# Drop AI v3

Drop AI v3는 브라우저에서 오디오 파일을 업로드하고, Web UI 또는 CLI 명령으로 편집한 뒤 WAV 파일로 내보내는 오디오 편집 MVP입니다.

이 프로젝트의 목적은 완성형 DAW(Digital Audio Workstation)를 만드는 것이 아니라, Web UI, CLI, 향후 AI agent가 같은 편집 상태를 안정적으로 공유할 수 있는 프론트엔드 아키텍처를 검증하는 것입니다.

핵심 아이디어는 모든 편집 요청을 `command`로 표현하고, 하나의 실행 경로에서 검증하고 처리하는 것입니다. 이를 통해 입력 방식이 늘어나도 같은 명령은 같은 상태 변경 흐름을 따르도록 만들었습니다.

## 현재 구현 범위

현재 MVP에서 확인할 수 있는 흐름은 다음과 같습니다.

```txt
오디오 파일 업로드
-> asset.register
-> track.add
-> region.add
-> 인앱 CLI 표시
-> CLI 명령으로 session 편집
-> session.export 또는 export 명령 실행
-> 브라우저 다운로드 시작
```

구현 상태는 다음과 같습니다.

- 완료: 업로드 화면, 파일 업로드 후 기본 track/region 생성
- 완료: Web UI와 CLI가 같은 `command` 실행 경로를 사용
- 완료: CLI 명령으로 playback, track, region, session export 명령 실행
- 완료: `FakeAudioEngine` 기반 export 다운로드 트리거
- 완료: `ToneAudioEngine` adapter 구현과 테스트
- 제한: 기본 Web 앱은 아직 `FakeAudioEngine`을 사용
- 제한: 기본 실행 경로의 export 결과는 빈 `audio/wav` Blob
- 미완료: 실제 오디오 디코딩, 재생, offline export를 기본 Web 앱에 연결

## 기술 스택

- React 19
- TypeScript
- Vite
- Zustand vanilla store
- Zod
- Tone.js
- xterm.js
- Vitest
- vanilla-extract

## 빠른 시작

### 준비 사항

- Node.js 22 이상
- pnpm 9 이상

기준 버전은 `package.json`의 `volta`와 `engines` 필드를 따릅니다.

### 설치 및 실행

```sh
pnpm install
pnpm dev
```

Vite가 출력한 로컬 주소를 브라우저에서 엽니다. 기본 주소는 보통 다음과 같습니다.

```txt
http://localhost:5173/
```

## 사용 방법

1. 첫 화면에서 오디오 파일을 선택하거나 드래그앤드롭합니다.
2. 업로드가 성공하면 앱이 자동으로 asset, track, region을 생성합니다.
3. 화면과 CLI welcome text에 표시된 `assetId`, `trackId`, `regionId`를 확인합니다.
4. `commands`로 사용할 수 있는 CLI 명령을 확인합니다.
5. `status`로 현재 session 상태를 확인합니다.
6. `region move`, `region split`, `region resize` 등으로 편집합니다.
7. `session export mix.wav` 또는 `export mix.wav`로 다운로드를 시작합니다.

예시:

```txt
commands
status
region split track-1 region-1 1
region move track-1 region-1 0.5
export mix.wav
```

실제 ID는 실행 환경의 `idGenerator`에 따라 달라질 수 있습니다. 화면에 표시된 ID를 기준으로 입력합니다.

## 아키텍처 개요

Drop AI v3는 View 로직, 상태 관리, 오디오 처리 로직이 섞이지 않도록 레이어를 나누었습니다.

```txt
Apps
  Web UI
  CLI
    |
    v
AppController
  executeCommand(command)
    |
    v
CommandController
  command 검증과 분기
    |
    +-> PlaybackController
    +-> AssetController
    +-> TrackController
    +-> SessionExportController
          |
          +-> SessionStore
          +-> IAudioEngine
```

### Command 기반 실행 흐름

Web UI, CLI, 향후 AI agent가 같은 편집 상태를 공유하려면 입력 경로마다 다른 방식으로 controller를 호출하지 않아야 합니다. 입력 경로가 분산되면 같은 기능도 검증 규칙, 실행 순서, 오류 처리 방식이 달라질 수 있습니다.

이를 막기 위해 모든 편집 의도를 `type`과 `payload`를 가진 `command` 객체로 표현합니다.

```ts
{
  type: 'region.move',
  payload: {
    trackId: 'track-1',
    regionId: 'region-1',
    startTime: 0.5,
  },
}
```

모든 command는 `AppController.executeCommand()`를 통과합니다. 이 진입점에서 Zod 기반 `commandSchema`로 payload를 검증하고, `CommandController`가 command type에 따라 적절한 controller로 분기합니다.

이 구조의 효과는 다음과 같습니다.

- Web UI와 CLI가 같은 validation 흐름을 사용합니다.
- 입력 채널이 늘어나도 domain controller 호출 규칙을 반복 구현하지 않아도 됩니다.
- 같은 command는 같은 session state 변경 흐름을 따릅니다.
- validation failure와 execution failure를 구분해 오류 처리가 단순해집니다.

### AppController Facade

`AppController`는 여러 controller를 하나의 실행 인터페이스 뒤에 두는 Facade 역할을 합니다.

상위 레이어인 Web UI와 CLI는 `PlaybackController`, `TrackController`, `AssetController`, `SessionExportController`의 세부 메서드를 직접 알 필요가 없습니다. 대신 어떤 작업을 하고 싶은지만 command로 전달합니다.

```ts
await appController.executeCommand({
  type: 'track.volume.set',
  payload: {
    trackId: 'track-1',
    volume: 0.8,
  },
});
```

이 방식은 UI 코드가 "어떤 controller의 어떤 메서드를 호출할지"보다 "어떤 사용자 의도를 전달할지"에 집중하게 만듭니다.

### Session State와 상태 관리

편집 상태는 `session state`로 관리합니다. track과 region은 순서 정보와 상세 정보를 분리해 정규화된 형태로 저장합니다.

```txt
session
  trackOrder
  tracksById
    track
      regionOrder
      regionsById
```

상태 변경 로직은 `sessionOps`의 순수 함수로 분리했습니다. 예를 들어 region 이동, 분할, 크기 변경은 UI나 audio engine 없이도 입력 state와 command payload만으로 테스트할 수 있습니다.

React UI는 쓰기 가능한 store에 직접 접근하지 않습니다. `useSyncExternalStore`로 읽기 전용 `sessionReader`를 구독하고, 상태 변경은 controller를 통해서만 수행합니다.

### Audio Engine Interface와 Adapter

오디오 엔진이 프론트엔드 코드베이스 안에 함께 있으면 UI, session state, WebAudio side effect, 외부 라이브러리 의존성이 쉽게 섞일 수 있습니다.

이를 막기 위해 controller는 구체 구현이 아니라 `IAudioEngine` Interface에만 의존합니다.

```txt
Controller
  -> IAudioEngine
      -> FakeAudioEngine
      -> ToneAudioEngine
```

`FakeAudioEngine`은 테스트와 기본 Web 앱 실행에 사용합니다. 실제 WebAudio 기반 구현은 `ToneAudioEngine` adapter 안에 격리했습니다.

Tone.js를 adapter 내부로 제한한 이유는 다음과 같습니다.

- controller가 외부 라이브러리 API에 직접 의존하지 않도록 하기 위해
- 테스트에서 브라우저 오디오 런타임이 필요하지 않게 하기 위해
- 오디오 엔진 교체 시 변경 범위를 줄이기 위해
- session state 변경과 audio side effect의 책임을 분리하기 위해

### CLI Command Registry

CLI 명령은 `src/apps/cli/command-registry.ts`에서 관리합니다.

이 registry는 다음 역할을 함께 담당합니다.

- CLI 입력 파싱
- `commands` 출력
- CLI 명령과 internal command type 매핑

명령 정의를 한 곳에 모아두면 parser, 도움말, 실행 command가 서로 어긋날 가능성을 줄일 수 있습니다.

## CLI 명령

### Playback

```txt
play
pause
stop
seek <seconds>
loop off
loop <start> <end>
bpm <value>
master <0..1>
```

### Track

```txt
track add
track remove <trackId>
volume <trackId> <0..1>
mute <trackId> on|off
solo <trackId> on|off
pan <trackId> <-1..1>
```

### Region

```txt
region add <trackId> <assetId> [startTime]
region move <trackId> <regionId> <startTime>
region split <trackId> <regionId> <splitTime>
region resize <trackId> <regionId> <duration>
region remove <trackId> <regionId>
```

### Session

```txt
session export [filename]
export [filename]
```

`export`는 `session export`의 alias입니다. 내부 command type은 `session.export`입니다.

## 프로젝트 구조

```txt
src/apps/web        React Web UI, upload flow, in-app CLI
src/apps/cli        CLI runner, local commands, command registry
src/controllers     command schema, AppController, domain controllers
src/session         session state, session store, session operations
src/audio-engine    IAudioEngine, FakeAudioEngine, ToneAudioEngine
src/composition     dependency composition
src/testing         test utilities and architecture boundary tests
docs                planning and architecture notes
```

## 테스트와 검증

개별 검증 명령은 다음과 같습니다.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

전체 검증은 다음 명령으로 실행합니다.

```sh
pnpm check
```

테스트는 다음 영역을 다룹니다.

- command schema validation
- command controller integration
- upload flow
- session operation
- audio engine adapter
- CLI parser and runner
- architecture boundary

architecture boundary test는 다음 규칙을 검증합니다.

- `tone` import는 `audio-engine/tone` 내부에서만 허용
- controller는 `IAudioEngine` Interface에만 의존
- apps는 session과 audio-engine에 직접 의존하지 않음
- 쓰기 가능한 session store는 controllers와 composition에서만 접근

## 수동 QA

개발 서버에서 다음 흐름을 확인합니다.

1. 첫 진입 시 업로드 화면만 표시되는지 확인합니다.
2. 오디오 파일 업로드 후 workspace와 CLI가 표시되는지 확인합니다.
3. `commands`를 입력해 명령 목록이 출력되는지 확인합니다.
4. `status`를 입력해 현재 session 상태가 출력되는지 확인합니다.
5. `region split`, `region move`, `region resize` 명령이 session summary에 반영되는지 확인합니다.
6. `export <filename>` 실행 후 다운로드가 시작되는지 확인합니다.

## 현재 범위에 포함하지 않은 것

아래 항목은 현재 MVP 완료 조건에 포함하지 않았습니다.

- 프로젝트 저장과 복원
- 백엔드 업로드
- 다중 파일 업로드
- 완성형 waveform/timeline UI
- 실제 오디오 엔진을 기본 Web 앱에 연결
- AI 자동 편집 workflow
- plugin SDK
- `@drop-ai/core` 패키지 배포

## 다음 작업

추천 구현 순서는 다음과 같습니다.

1. `ToneAudioEngine`을 기본 Web composition에 연결합니다.
2. 실제 오디오 파일 기준으로 재생과 export를 수동 QA합니다.
3. command registry metadata를 command palette와 AI agent가 함께 사용할 수 있는 형태로 확장합니다.
4. core 로직과 React adapter 경계를 더 명확히 분리합니다.
5. plugin SDK 설계를 문서화한 뒤 command 실행 경계와 연결합니다.

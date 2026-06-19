# Drop AI v3

Drop AI v3는 브라우저에서 실제 오디오 파일을 업로드하고, 편집하고, 재생하고, WAV로 export할 수 있는 lightweight DAW(Digital Audio Workstation)를 목표로 합니다.

`command-first`는 제품 목표가 아니라 내부 설계 원칙입니다. 편집 의도를 `type`과 `payload`를 가진 plain object로 표현하고, Web UI와 인앱 CLI가 같은 `AppController.executeCommand()` 실행 경계를 통과하게 해서 UI, CLI, agent, plugin 같은 입력 경로가 같은 편집 코어를 공유하도록 합니다.

## 제품 목표

우선순위는 "구조 검증"이 아니라 사용자가 체감할 수 있는 작동 흐름입니다.

```txt
오디오 파일 업로드
-> asset.register
-> track.add
-> region.add
-> 실제 재생
-> region 편집
-> 실제 export
-> 필요하면 프로젝트 저장/복원
```

작동하는 프로젝트의 기준은 다음과 같습니다.

- 파일을 업로드하면 실제 소리가 납니다.
- play, pause, stop, seek가 브라우저에서 체감됩니다.
- region move, split, resize가 session state와 실제 재생/export에 반영됩니다.
- export한 WAV가 실제 오디오를 담고 있습니다.
- 새로고침이나 재방문에도 최소한의 작업 상태를 잃지 않습니다.

## 현재 구현 범위

현재 코드는 작동하는 DAW로 전환 중입니다.

완료된 기반:

- 업로드 진입 화면
- 업로드 후 기본 asset, track, region 생성
- 인앱 CLI 표시
- CLI 편집 명령
- `session.export` / `export` 명령과 다운로드 트리거
- CLI 명령 정의를 `command-registry.ts`에 모으고 parser와 `commands` 출력이 같은 registry를 사용
- `ToneAudioEngine` 구현과 테스트

아직 제품 기준으로 부족한 부분:

- 기본 Web composition은 아직 `FakeAudioEngine`을 사용합니다.
- 기본 실행 경로의 export 파일은 빈 `audio/wav` Blob입니다.
- 실제 오디오 디코딩, 재생, export가 기본 Web 앱에 연결되어야 합니다.
- timeline/waveform 기반의 직접 편집 UI는 아직 없습니다.
- 프로젝트 저장/복원은 아직 없습니다.

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

현재 사용 가능한 흐름:

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

`FakeAudioEngine`은 테스트와 격리된 개발 확인에 사용합니다. `ToneAudioEngine`은 제품 실행 경로의 기본 구현이 되어야 합니다.

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

주요 경계:

- Apps는 controller의 세부 메서드를 직접 호출하지 않고 command를 보냅니다.
- CLI 문자열 입력은 registry parser를 거쳐 `AppCommand`로 변환됩니다.
- `commandSchema`는 controller 실행 전에 command payload를 검증합니다.
- Controller는 `IAudioEngine` Interface에만 의존합니다.
- 객체 생성과 의존성 조립은 composition root에서 수행합니다.

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

수동 QA에서는 현재 구현과 목표 구현을 구분합니다.

현재 구현에서 확인할 항목:

1. 첫 진입 시 업로드 화면만 표시되는지 확인합니다.
2. 오디오 파일 업로드 후 workspace와 CLI가 표시되는지 확인합니다.
3. `commands`를 입력해 명령 목록이 출력되는지 확인합니다.
4. `status`를 입력해 현재 session 상태가 출력되는지 확인합니다.
5. `region split`, `region move`, `region resize` 명령이 session summary에 반영되는지 확인합니다.
6. `export <filename>` 실행 후 다운로드가 시작되는지 확인합니다.

작동하는 DAW 기준으로 추가 확인할 항목:

- 업로드한 파일이 실제로 재생되는지
- playback command가 실제 transport에 반영되는지
- region 편집이 실제 재생 위치와 export 결과에 반영되는지
- export한 WAV를 외부 플레이어에서 열었을 때 실제 오디오가 들리는지
- 새로고침 후 저장된 프로젝트를 복원할 수 있는지

## 로드맵

작동하는 프로젝트를 만들기 위한 추천 구현 순서는 다음과 같습니다.

1. `ToneAudioEngine`을 기본 Web composition에 연결합니다.
2. 실제 오디오 파일 기준으로 업로드, 재생, seek, stop을 수동 QA합니다.
3. `session.export`가 실제 WAV를 생성하는지 확인하고 실패 케이스를 정리합니다.
4. transport UI를 추가해 CLI 없이도 play, pause, stop, seek를 사용할 수 있게 합니다.
5. 최소 timeline UI를 추가해 track과 region을 눈으로 확인하고 편집할 수 있게 합니다.
6. region move, split, resize가 실제 재생과 export에 반영되도록 QA를 고정합니다.
7. IndexedDB 기반 프로젝트 저장/복원을 추가합니다.
8. 다중 파일 업로드와 asset 관리 UI를 추가합니다.

## 이후 확장

다음 항목은 작동하는 single-user DAW 흐름이 안정된 뒤 확장합니다.

- backend 업로드
- 결제 기능
- Plugin SDK
- AI 자동 작곡 workflow
- `@drop-ai/core` 패키지 배포
- 외부 audio engine adapter

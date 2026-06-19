# Drop AI v3

Drop AI v3는 브라우저에서 실제 오디오 파일을 업로드하고, 편집하고, 재생하고, WAV로 export할 수 있는 lightweight DAW(Digital Audio Workstation)를 목표로 한다.

`command-first`는 제품 목표가 아니라 내부 설계 원칙이다. 편집 의도를 `type`과 `payload`를 가진 plain object로 표현하고, Web UI와 인앱 CLI가 같은 `AppController.executeCommand()` 실행 경계를 통과하게 해서 UI, CLI, agent, plugin 같은 입력 경로가 같은 편집 코어를 공유하도록 한다.

## Product Goal

우선순위는 "구조 검증"이 아니라 사용자가 체감할 수 있는 작동 흐름이다.

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

작동하는 프로젝트의 기준은 다음과 같다.

- 파일을 업로드하면 실제 소리가 난다.
- play, pause, stop, seek가 브라우저에서 체감된다.
- region move, split, resize가 session state와 실제 재생/export에 반영된다.
- export한 WAV가 실제 오디오를 담고 있다.
- 새로고침이나 재방문에도 최소한의 작업 상태를 잃지 않는다.

## Current Status

현재 코드는 작동하는 DAW로 전환 중이다.

완료된 기반:

- 업로드 진입 화면
- 업로드 후 기본 asset, track, region 생성
- 인앱 CLI 표시
- CLI 편집 명령
- `session.export` / `export` 명령과 다운로드 트리거
- CLI 명령 정의를 `command-registry.ts`에 모으고 parser와 `commands` 출력이 같은 registry를 사용
- `ToneAudioEngine` 구현과 테스트

아직 제품 기준으로 부족한 부분:

- 기본 Web composition은 아직 `FakeAudioEngine`을 사용한다.
- 기본 실행 경로의 export 파일은 빈 `audio/wav` Blob이다.
- 실제 오디오 디코딩, 재생, export가 기본 Web 앱에 연결되어야 한다.
- timeline/waveform 기반의 직접 편집 UI는 아직 없다.
- 프로젝트 저장/복원은 아직 없다.

## Prerequisites

- Node.js 22 이상
- pnpm 9 이상

기준 버전은 `package.json`의 `volta`와 `engines` 필드를 따른다.

## Quick Start

의존성을 설치하고 개발 서버를 실행한다.

```sh
pnpm install
pnpm dev
```

브라우저에서 Vite가 출력한 로컬 주소를 연다. 기본 주소는 보통 다음과 같다.

```txt
http://localhost:5173/
```

## Usage

현재 사용 가능한 흐름:

1. 첫 화면에서 오디오 파일을 선택하거나 드래그앤드롭한다.
2. 업로드가 성공하면 앱이 자동으로 asset, track, region을 만든다.
3. 화면에 표시된 `assetId`, `trackId`, `regionId`를 CLI 명령에 사용한다.
4. `commands`로 사용 가능한 명령을 확인한다.
5. `status`로 현재 세션 상태를 확인한다.
6. `session export mix.wav` 또는 `export mix.wav`를 실행해 다운로드를 시작한다.

예시:

```txt
commands
status
region split track-1 region-1 1
region move track-1 region-1 0.5
export mix.wav
```

실제 ID는 실행 환경의 `idGenerator`에 따라 달라질 수 있다. 화면과 CLI welcome text에 표시된 값을 기준으로 입력한다.

## Quality Checks

개별 확인 명령은 다음과 같다.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

전체 확인은 다음 명령을 사용한다.

```sh
pnpm check
```

수동 QA에서는 현재 구현과 목표 구현을 구분한다.

현재 구현에서 확인할 항목:

- 첫 진입 시 업로드 화면만 보이는지
- 파일 업로드 후 세션 요약과 CLI가 표시되는지
- `help`, `commands`, `status`가 세션을 변경하지 않고 출력만 수행하는지
- region 편집 명령이 세션 요약에 반영되는지
- `export <filename>` 실행 후 다운로드가 시작되는지

작동하는 DAW 기준으로 추가 확인할 항목:

- 업로드한 파일이 실제로 재생되는지
- playback command가 실제 transport에 반영되는지
- region 편집이 실제 재생 위치와 export 결과에 반영되는지
- export한 WAV를 외부 플레이어에서 열었을 때 실제 오디오가 들리는지
- 새로고침 후 저장된 프로젝트를 복원할 수 있는지

## Command Surface

CLI 명령 정의는 [src/apps/cli/command-registry.ts](./src/apps/cli/command-registry.ts)에 있다. parser와 `commands` 출력은 이 registry를 공유한다.

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

`export`는 CLI alias다. 내부 command type은 `session.export`다.

## Architecture

상태 변경은 `AppController.executeCommand()`를 통과한다.

```txt
Apps
  -> AppController.executeCommand(rawCommand)
    -> CommandController
      -> PlaybackController
      -> AssetController
      -> TrackController
      -> SessionExportController
        -> SessionStore
        -> IAudioEngine
```

주요 경계는 다음과 같다.

- Apps는 controller의 세부 메서드를 직접 호출하지 않고 command를 보낸다.
- CLI 문자열 입력은 registry parser를 거쳐 `AppCommand`로 변환된다.
- `commandSchema`는 controller 실행 전에 command payload를 검증한다.
- Controller는 `IAudioEngine` 인터페이스에 의존한다.
- `ToneAudioEngine`은 제품 실행 경로의 기본 구현이 되어야 한다.
- `FakeAudioEngine`은 테스트와 격리된 개발 확인을 위한 구현체로 둔다.
- 객체 생성과 의존성 조립은 composition root에서 수행한다.

## Project Layout

```txt
src/apps/web        React Web UI, upload flow, in-app CLI
src/apps/cli        CLI runner, local commands, command registry
src/controllers     command schema and domain controllers
src/session         in-memory session state and operations
src/audio-engine    IAudioEngine, FakeAudioEngine, ToneAudioEngine
src/composition     application composition root
work-log            decision logs and architecture notes
```

## Roadmap

작동하는 프로젝트를 만들기 위한 추천 구현 순서는 다음과 같다.

1. `ToneAudioEngine`을 기본 Web composition에 연결한다.
2. 실제 오디오 파일 기준으로 업로드, 재생, seek, stop을 수동 QA한다.
3. `session.export`가 실제 WAV를 생성하는지 확인하고 실패 케이스를 정리한다.
4. transport UI를 추가해 CLI 없이도 play, pause, stop, seek를 사용할 수 있게 한다.
5. 최소 timeline UI를 추가해 track과 region을 눈으로 확인하고 편집할 수 있게 한다.
6. region move, split, resize가 실제 재생과 export에 반영되도록 QA를 고정한다.
7. IndexedDB 기반 프로젝트 저장/복원을 추가한다.
8. 다중 파일 업로드와 asset 관리 UI를 추가한다.

## Later

다음 항목은 작동하는 single-user DAW 흐름이 안정된 뒤 확장한다.

- backend 업로드
- 결제 기능
- Plugin SDK
- AI 자동 작곡 workflow
- `@drop-ai/core` 패키지 배포
- 외부 audio engine adapter

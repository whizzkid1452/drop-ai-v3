# Drop AI v3

Drop AI v3는 command-first 구조를 검증하기 위한 브라우저 기반 DAW(Digital Audio Workstation) MVP다.

여기서 command-first는 편집 의도를 `type`과 `payload`를 가진 plain object로 표현하고, Web UI와 인앱 CLI가 같은 `AppController.executeCommand()` 실행 경계를 통과한다는 뜻이다.

## Current Status

현재 구현된 1차 MVP 흐름은 다음과 같다.

```txt
오디오 파일 업로드
-> asset.register
-> track.add
-> region.add
-> 인앱 CLI 표시
-> CLI 명령으로 세션 편집
-> session.export 또는 export 명령
-> 브라우저 다운로드 시작
```

현재 기본 앱 조립은 `FakeAudioEngine`을 사용한다. 따라서 개발 서버에서 확인하는 기본 동작은 command/session 흐름 검증에 가깝다. `ToneAudioEngine` 구현과 테스트는 존재하지만, 기본 Web composition에는 아직 연결되어 있지 않다.

정확히 구분하면 다음과 같다.

- 완료: 업로드 진입 화면, 업로드 후 기본 track/region 생성, CLI 편집 명령, export 명령, export 다운로드 트리거
- 완료: CLI 명령 정의를 `command-registry.ts`에 모으고, parser와 `commands` 출력이 같은 registry를 사용
- 제한: 기본 실행 경로의 export 파일은 `FakeAudioEngine`이 만든 빈 `audio/wav` Blob이다
- 미완료: 실제 오디오 디코딩/재생/export를 기본 Web 앱에 연결하는 작업

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

## MVP Usage

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

## Verification

개별 검증 명령은 다음과 같다.

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

수동 QA에서는 다음 흐름을 확인한다.

- 첫 진입 시 업로드 화면만 보이는지
- 파일 업로드 후 세션 요약과 CLI가 표시되는지
- `help`, `commands`, `status`가 세션을 변경하지 않고 출력만 수행하는지
- region 편집 명령이 세션 요약에 반영되는지
- `export <filename>` 실행 후 다운로드가 시작되는지

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
- `FakeAudioEngine`과 `ToneAudioEngine`은 교체 가능한 구현체다.
- 객체 생성과 의존성 조립은 composition root에서 수행한다.

## Project Layout

```txt
src/apps/web        React Web UI, upload flow, in-app CLI
src/apps/cli        CLI runner, local commands, command registry
src/controllers     command schema and domain controllers
src/session         in-memory session state and operations
src/audio-engine    IAudioEngine, FakeAudioEngine, ToneAudioEngine
src/composition     application composition root
docs                planning and architecture notes
AGENTS              project conventions
```

## Non-Goals

현재 1차 MVP 범위가 아닌 항목은 다음과 같다.

- 프로젝트 저장과 복원
- backend 업로드
- 결제 기능
- Plugin SDK
- 다중 파일 업로드
- 완성형 waveform/timeline UI
- AI 자동 작곡 workflow
- `@drop-ai/core` 패키지 배포

이 항목들은 구현하지 않겠다는 뜻이 아니라, 현재 MVP 완료 조건에 포함하지 않았다는 뜻이다.

## Next Steps

추천 구현 순서는 다음과 같다.

1. `ToneAudioEngine`을 기본 Web composition에 연결한다.
2. 실제 오디오 파일 기준으로 재생과 export를 수동 QA한다.
3. command registry의 metadata를 CLI, UI command palette, agent, plugin SDK가 공유할 수 있는 형태로 확장한다.
4. `@drop-ai/core` 패키지 경계를 분리한다.
5. 외부 audio engine adapter와 plugin SDK 설계를 문서화한 뒤 구현한다.

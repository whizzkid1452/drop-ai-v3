# Drop AI v3

Drop AI v3는 command-first 브라우저 DAW(Digital Audio Workstation) 코어다.

여기서 command-first는 사용자의 편집 의도를 `type`과 `payload`를 가진
검증 가능한 plain object로 표현하고, Web UI와 인앱 CLI가 같은
`AppController.executeCommand` 경계를 통과한다는 뜻이다.

## Goal

현재 목표는 완성형 DAW UI가 아니라, 다음 최소 사용자 흐름을 신뢰할 수
있게 만드는 것이다.

```txt
오디오 파일 업로드
-> asset.register
-> track.add
-> region.add
-> 인앱 CLI로 세션 편집
-> session.export
```

이 흐름에서 `asset.register`는 파일을 asset으로 등록한다. export 가능한
세션을 만들기 위한 충분조건은 아니므로, 업로드 성공 후 기본 track과
region을 함께 만든다.

## Prerequisites

- Node.js 22 이상
- pnpm 9 이상

프로젝트의 기준 버전은 `package.json`의 `volta`와 `engines` 필드를 따른다.

## Quick Start

```sh
pnpm install
pnpm dev
```

검증 명령은 다음과 같다.

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

전체 확인이 필요하면 아래 명령을 사용한다.

```sh
pnpm check
```

## Current Implementation

직접 확인 가능한 현재 구현 상태는 다음과 같다.

- Web 앱은 업로드 전용 화면으로 시작한다.
- 파일 선택 또는 드래그앤드롭으로 오디오 파일을 받을 수 있다.
- 업로드 성공 시 `asset.register -> track.add -> region.add` 순서로 command를 실행한다.
- 업로드 후에는 세션 요약과 xterm 기반 인앱 CLI를 표시한다.
- CLI에는 `help`, `commands`, `status` 로컬 명령이 있다.
- CLI 입력은 parser를 거쳐 command로 변환되고, command schema 검증 후 controller에서 실행된다.
- `session.export`는 세션 duration이 0 이하이면 `Cannot export an empty session.` 오류를 낸다.

현재 기본 앱 조립(`createApp()`)은 `FakeAudioEngine`을 사용한다. 따라서 기본
개발 실행은 command/session 흐름을 검증하는 상태이며, 실제 오디오 디코딩과
WAV 렌더링은 `ToneAudioEngine`을 기본 Web composition에 연결해야 제품 동작으로
볼 수 있다. `ToneAudioEngine` 구현과 테스트는 존재하지만, 기본 `AppProvider`
경로에 연결되어 있지는 않다.

## Command Surface

### Playback

```txt
play
pause
stop
seek <seconds>
loop <start> <end>
loop off
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

`export`는 CLI parser가 `session.export` command로 변환하는 alias다. command
schema의 정식 command type은 `session.export`다.

## Architecture

입력 경로는 Web UI, CLI, 테스트 등으로 늘어날 수 있지만, 상태 변경은 하나의
command 경계를 통과한다.

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

핵심 의존성 규칙은 다음과 같다.

- Apps는 controller의 구체 동작을 직접 호출하지 않고 command를 보낸다.
- Controller는 `IAudioEngine` 인터페이스에 의존한다.
- 객체 생성과 조립은 composition root에서 수행한다.
- Session은 현재 in-memory 작업 상태다. 프로젝트 저장, 복원, autosave는 현재 기본 범위가 아니다.

## Project Layout

```txt
src/apps/web        React Web UI, upload flow, in-app CLI
src/apps/cli        CLI parser, local commands, CLI runner
src/controllers     command schema and domain controllers
src/session         in-memory session state and operations
src/audio-engine    IAudioEngine, FakeAudioEngine, ToneAudioEngine
src/composition     application composition root
docs                planning and architecture notes
AGENTS             project conventions
```

## Current Non-Goals

현재 범위가 아닌 항목은 다음과 같다.

- 프로젝트 저장과 복원
- backend 업로드
- 결제 기능
- Plugin SDK
- 다중 파일 업로드
- 완성형 waveform/timeline UI
- AI 자동 작곡 workflow

이 항목들은 구현 불가능하다는 뜻이 아니라, 현재 MVP의 완료 조건이 아니라는
뜻이다.

## Related Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/PROJECT_IDENTITY.md](./docs/PROJECT_IDENTITY.md)
- [docs/mvp-upload-cli-export-plan.md](./docs/mvp-upload-cli-export-plan.md)
- [AGENTS/COMMIT_CONVENTION.md](./AGENTS/COMMIT_CONVENTION.md)

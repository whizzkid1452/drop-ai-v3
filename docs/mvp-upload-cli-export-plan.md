# Drop AI v3 MVP 플랜

## 목표

이번 MVP는 결제, Plugin SDK, 패키지 배포보다 먼저 **파일 업로드부터 기존 편집 명령 실행, export까지 이어지는 하나의 사용자 흐름**을 완성한다.

MVP 완료 흐름은 다음과 같다.

```txt
앱 진입
→ 드래그앤드롭 업로드 화면만 표시
→ 오디오 파일 업로드
→ asset.register command 실행
→ 기본 track 생성
→ 업로드된 asset을 region으로 배치
→ CLI 창 표시
→ 사용법과 명령어 목록 안내
→ 기존 편집 명령 실행
→ session export 실행
```

## 근거 수준

### 사실

- `App.tsx`는 현재 진입 화면에서 Session 패널, Add Track 버튼, CLI 패널을 즉시 표시한다.
- `CliTerminal.tsx`는 xterm 기반 인앱 CLI를 이미 렌더링한다.
- `cli-parser.ts`는 `play`, `pause`, `stop`, `seek`, `loop`, `bpm`, `master`, `track`, `volume`, `mute`, `solo`, `pan`, `region`, `session export` 입력을 command로 변환한다.
- `CommandController`는 `asset.register`, `track.*`, `region.*`, `playback.*`, `session.export` command를 실행한다.
- `AssetController.registerFileAsset`는 `IAudioEngine.importFileAsset(assetId, file)`을 호출하고 `{ id, duration }`을 반환한다.
- `SessionExportController.exportSession`은 세션 duration이 0 이하이면 `Cannot export an empty session.` 오류를 던진다.
- `ARCHITECTURE.md`는 UI 드래그앤드롭 흐름을 `asset.register` → `region.add` 두 command 순차 발행으로 설명한다.

### 추론

- 현재 구조에서 “파일 업로드 후 바로 export 가능” 상태를 만들려면 업로드 직후 track과 region이 있어야 한다.
- `asset.register`만 실행하면 session state에는 region이 추가되지 않으므로 export 가능한 세션이 되지 않는다.
- 따라서 MVP 업로드 성공 흐름은 `asset.register` 이후 `track.add`와 `region.add`까지 연결해야 한다.
- CLI는 이미 존재하므로 MVP의 핵심 작업은 CLI 자체 구현보다 업로드 전후 화면 상태와 도움말 품질을 완성하는 것이다.

### 가정

- “CLI 창”은 별도 OS terminal이 아니라 현재 `src/apps/web/cli/CliTerminal.tsx`의 인앱 CLI를 뜻한다.
- MVP의 업로드 파일은 browser `File` 객체로 다룬다.
- 첫 MVP에서는 업로드한 파일을 기본 track 하나에 region 하나로 자동 배치한다.
- 여러 파일 업로드는 MVP 이후 확장으로 미룬다.

## MVP 범위

### 포함한다

- 초기 진입 시 업로드 전용 화면
- 드래그앤드롭 업로드
- 파일 선택 버튼 업로드
- `asset.register` command 실행
- 업로드 성공 후 기본 track 자동 생성
- 업로드 asset을 기본 region으로 자동 배치
- 업로드 성공 후 CLI 패널 표시
- CLI 첫 진입 도움말 개선
- `help`, `commands`, `status` CLI 명령 추가
- 기존 편집 명령 목록 안내
- `session export <filename>` 실행 안내와 결과 표시
- 업로드/CLI/export 흐름 테스트

### 제외한다

- 결제 기능
- Plugin SDK
- npm package 배포
- monorepo 전환
- 다중 파일 업로드
- 고급 waveform UI
- full-featured DAW timeline 편집 UI
- production-grade telemetry
- 실제 backend 업로드

## 현재 사용 가능한 Command

현재 parser와 schema 기준으로 MVP에서 안내할 command는 다음과 같다.

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
```

## 핵심 설계 결정

### 1. 업로드는 UI event지만 상태 변경은 command로 수행한다

드래그앤드롭이나 파일 선택은 browser UI event이다. 그러나 업로드 결과를 앱 상태에 반영하는 write path는 `AppController.executeCommand`로 통일한다.

업로드 성공 시 실행 순서는 다음과 같다.

```txt
asset.register
→ track.add
→ region.add
```

이 순서는 export 가능 조건을 만족시키기 위한 최소 조건이다. `session.export`는 region이 없는 세션을 export할 수 없기 때문이다.

### 2. CLI는 업로드 이후에만 표시한다

초기 상태에서 CLI를 보여주면 사용자가 assetId와 trackId가 없는 상태에서 편집 명령을 실행할 수 있다.

따라서 MVP에서는 업로드 전 화면과 업로드 후 CLI 화면을 명확히 나눈다.

```txt
empty: UploadDropzone만 표시
uploading: UploadDropzone + 진행 상태 표시
ready: CLI + session summary 표시
failed: UploadDropzone + 오류 메시지 표시
```

### 3. Export 명령은 기존 `session export`를 유지한다

현재 parser는 `session export final mix.wav`를 `session.export` command로 변환한다.

MVP에서는 새 명령어 `export`를 추가하지 않고, 기존 명령을 우선 완성한다. 필요하면 MVP 이후 alias로 `export <filename>`을 추가한다.

## 구현 단계

## Phase 0. 기존 테스트 기준선 확인

### 목적

현재 command, controller, web app 테스트가 통과하는지 확인하고 MVP 변경의 회귀 기준을 잡는다.

### 작업

1. 현재 테스트를 실행한다.
2. 실패 테스트가 있으면 MVP 작업과 관련 있는지 분류한다.
3. 업로드와 CLI 변경 전 기준선을 기록한다.

### 검증

```sh
pnpm test
pnpm typecheck
pnpm lint
```

## Phase 1. 업로드 상태 모델 추가

### 목적

`App.tsx`가 업로드 전후 화면을 구분할 수 있게 만든다.

### 제안 타입

```ts
type UploadFlowState =
  | { status: 'empty' }
  | { status: 'uploading'; filename: string }
  | {
      status: 'ready';
      assetId: string;
      trackId: string;
      regionId: string;
      filename: string;
    }
  | { status: 'failed'; message: string };
```

### 작업

1. `App.tsx`에서 업로드 상태를 관리한다.
2. 업로드 전에는 업로드 화면만 렌더링한다.
3. 업로드 중에는 중복 업로드를 막는다.
4. 실패 시 다시 업로드 가능한 상태로 남긴다.

### 테스트

- 초기 렌더링에서 CLI가 보이지 않는다.
- 초기 렌더링에서 업로드 UI만 보인다.
- 실패 상태에서 오류 메시지가 보인다.

## Phase 2. UploadDropzone 구현

### 목적

드래그앤드롭과 파일 선택 버튼으로 browser `File`을 받을 수 있게 한다.

### 작업

1. `src/apps/web/upload/UploadDropzone.tsx`를 추가한다.
2. `dragover`, `drop`, `input[type=file]` 흐름을 구현한다.
3. 지원 파일 형식을 안내한다.
4. 최소 validation을 추가한다.

### 초기 validation

- 파일이 존재해야 한다.
- MIME type이 `audio/`로 시작하거나 파일 확장자가 `.wav`, `.mp3`, `.m4a`, `.aac`, `.ogg`, `.flac` 중 하나여야 한다.

### 테스트

- 파일 선택으로 `onFileAccepted`가 호출된다.
- 드롭으로 `onFileAccepted`가 호출된다.
- 지원하지 않는 파일은 오류를 표시한다.

## Phase 3. 업로드 Command Pipeline 연결

### 목적

파일 업로드를 기존 command 경계로 연결한다.

### 실행 순서

```ts
const assetResult = await controller.executeCommand({
  type: 'asset.register',
  payload: { file },
});

const trackResult = await controller.executeCommand({ type: 'track.add' });

const regionResult = await controller.executeCommand({
  type: 'region.add',
  payload: {
    trackId: trackResult.data.id,
    assetId: assetResult.data.id,
    startTime: 0,
  },
});
```

### 실패 처리

- `asset.register` 실패: session 변경 없이 오류 표시
- `track.add` 실패: 오류 표시
- `region.add` 실패: 오류 표시

현재 `track.add` 이후 `region.add` 실패 시 track rollback은 구현되어 있지 않다. MVP에서는 실패 메시지를 표시하고, 이후 rollback 또는 compensating command를 P2로 둔다.

### 테스트

- 업로드 성공 시 `asset.register`, `track.add`, `region.add`가 순서대로 실행된다.
- 업로드 성공 후 CLI가 표시된다.
- 업로드 결과의 `assetId`, `trackId`, `regionId`가 CLI 안내에 표시된다.

## Phase 4. CLI 첫 진입 안내 개선

### 목적

파일 업로드 직후 사용자가 바로 명령을 실행할 수 있게 한다.

### 개선 내용

현재 `HELP_TEXT`는 명령 일부만 한 줄로 안내한다. MVP에서는 업로드 결과와 기본 명령을 포함한다.

예시 출력:

```txt
Drop AI CLI

업로드 완료:
  file: loop.wav
  assetId: asset-1
  trackId: track-1
  regionId: region-1

자주 쓰는 명령:
  play
  stop
  region split track-1 region-1 1.5
  region move track-1 region-1 2
  session export loop-edit.wav

전체 명령:
  commands

도움말:
  help
```

### 작업

1. `CliTerminal`이 업로드 context를 props로 받을 수 있게 한다.
2. 첫 진입 도움말을 함수로 분리한다.
3. 업로드 결과가 있으면 assetId, trackId, regionId를 안내한다.

### 테스트

- CLI 첫 출력에 업로드 파일명과 id들이 포함된다.
- CLI 첫 출력에 `commands`, `help`, `session export` 안내가 포함된다.

## Phase 5. `help`, `commands`, `status` 처리

### 목적

CLI에서 기능 발견 가능성을 높인다.

### 중요한 구분

`help`, `commands`, `status`는 domain write command가 아니다. 이들은 CLI local command이다.

따라서 다음 둘을 구분한다.

- domain command: `AppController.executeCommand`로 전달한다.
- CLI local command: CLI가 자체 처리한다.

### 작업

1. `runCli`에서 local command를 먼저 처리한다.
2. `help`는 사용법을 반환한다.
3. `commands`는 명령 목록을 반환한다.
4. `status`는 현재 session summary를 반환한다.

### 테스트

- `runCli('help')`는 controller를 호출하지 않는다.
- `runCli('commands')`는 command 목록을 반환한다.
- `runCli('status')`는 track/region/playback 상태를 반환한다.
- 기존 domain command는 계속 controller를 호출한다.

## Phase 6. Export 결과 UX 완성

### 목적

`session export` 실행 결과를 사용자가 확인하고 내려받을 수 있게 한다.

### 현재 상태

`SessionExportController.exportSession`은 `{ blob, filename }`을 반환한다. `formatCommandResult`는 이를 JSON 문자열로 출력한다. Blob은 JSON으로 유용하게 표시되지 않는다.

### 작업

1. `formatCommandResult`에서 `session.export` 결과를 별도 포맷한다.
2. browser CLI에서는 export 성공 시 object URL을 만들고 다운로드 링크 또는 자동 다운로드를 제공한다.
3. 최소 MVP에서는 CLI 출력에 filename과 blob size를 표시한다.

### 예시 출력

```txt
OK: session.export filename=loop-edit.wav size=123456 bytes
```

### 테스트

- 빈 세션 export 실패 메시지가 유지된다.
- region이 있는 세션 export는 filename과 size를 출력한다.
- `formatCommandResult`가 Blob 전체를 JSON으로 출력하지 않는다.

## Phase 7. 통합 검증

### 목적

사용자 흐름을 한 번에 검증한다.

### 테스트 시나리오

```txt
초기 렌더링
→ 업로드 화면 확인
→ audio file drop
→ CLI 표시 확인
→ commands 출력
→ region split 실행
→ session export 실행
→ export 결과 확인
```

### 실행 명령

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
npx prettier --write .
```

## 우선순위

### P0

- 초기 화면을 업로드 전용으로 변경
- 드래그앤드롭 업로드 구현
- 업로드 성공 시 `asset.register` → `track.add` → `region.add` 실행
- 업로드 후 CLI 표시
- CLI 첫 진입 안내에 업로드 결과와 명령 예시 표시
- `session export` 결과 포맷 개선

### P1

- `help`, `commands`, `status` local command 추가
- upload failure UX 정리
- 업로드/CLI/export 통합 테스트 추가
- session summary를 CLI와 UI에서 일관되게 표시

### P2

- `export <filename>` alias 추가
- `asset list`, `track list`, `region list` 같은 조회용 CLI 명령 추가
- `region.add` 실패 시 `track.add` 보상 처리
- upload flow를 별도 controller 또는 use case로 분리
- command trace 추가

### P3

- 결제
- Plugin SDK
- npm package 배포
- 실제 plugin sandbox
- 다중 파일 업로드
- 별도 OS terminal CLI

## 완료 기준

MVP는 다음 조건을 만족해야 한다.

- 앱 초기 진입 시 업로드 화면만 보인다.
- 업로드 전 CLI와 Session 패널은 보이지 않는다.
- 오디오 파일을 드래그앤드롭으로 업로드할 수 있다.
- 오디오 파일을 파일 선택 버튼으로 업로드할 수 있다.
- 업로드 성공 후 track과 region이 자동 생성된다.
- 업로드 성공 후 CLI가 표시된다.
- CLI 첫 화면에 업로드 결과와 명령어 예시가 표시된다.
- `help`, `commands`, `status`가 동작한다.
- 기존 `playback.*`, `track.*`, `region.*` 명령이 CLI에서 계속 동작한다.
- `session export <filename>`이 region이 있는 세션에서 성공한다.
- 빈 세션 export 실패 메시지가 명확하게 유지된다.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`가 통과한다.

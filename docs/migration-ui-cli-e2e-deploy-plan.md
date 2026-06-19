# Drop AI v3 UI, CLI, E2E, Deploy Migration Plan

> 문서 상태: 과거 migration 실행 계획.
>
> 현재 제품 목표는 command-first 구조 검증이 아니라 실제로 작동하는 browser lightweight DAW다. 최신 기준은 [README.md](../README.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [docs/README.md](./README.md)를 우선한다.

## 목적

이 문서는 기존 프로젝트인
`/Users/whizzkid/Documents/HURREAY/code/drop-ai`에서
`/Users/whizzkid/Documents/whizzkid/drop-ai-v3`로 마이그레이션할 때,
React UI, CLI terminal, Playwright e2e, Docker/Netlify 배포 설정을 어떤 순서로
리빌드할지 정리한다.

핵심 방향은 원본 UI를 그대로 복사하는 것이 아니다. `drop-ai-v3`에 이미 만들어진
command-first core를 기준으로 앱 shell, UI adapter, CLI terminal, e2e, 배포
설정을 다시 올린다.

```txt
Input Adapter
  -> AppCommand
  -> AppController.executeCommand(rawCommand)
  -> CommandController
  -> Domain Controller
  -> Session Store / Audio Engine
```

## 현재 상태

### 원본 프로젝트

위치:

```txt
/Users/whizzkid/Documents/HURREAY/code/drop-ai
```

원본에는 다음이 이미 있다.

- Vite + React 앱 shell
- React UI
- `xterm` 기반 CLI terminal
- `e2e/` Playwright 테스트
- `playwright.config.ts`
- `Dockerfile`, `Dockerfile.dev`, `docker-compose.yml`, `nginx.conf`
- `netlify.toml`

원본은 참고 자료로 사용한다. 특히 UI 구조, e2e 시나리오, 배포 설정은 참고하되
v3의 source layout과 command boundary를 깨지 않도록 그대로 복사하지 않는다.

### 대상 프로젝트

위치:

```txt
/Users/whizzkid/Documents/whizzkid/drop-ai-v3
```

대상에는 다음 core 구조가 이미 있다.

- `src/composition/create-app.ts`
- `src/controllers/app-controller.ts`
- `src/controllers/command-controller.ts`
- `src/controllers/command.schema.ts`
- `src/apps/cli/cli-parser.ts`
- `src/apps/cli/cli-runner.ts`
- `src/audio-engine/**`
- `src/session/**`

대상에 아직 필요한 영역은 다음이다.

- React/Vite browser app shell
- React UI components
- browser용 app provider와 session subscription hook
- `xterm` terminal component
- Playwright 설정과 e2e 시나리오
- Docker prod/dev 설정
- Netlify 설정

## 마이그레이션 원칙

### 1. v3 architecture를 기준으로 한다

`drop-ai-v3`의 현재 구조가 기준이다.

UI, CLI, keyboard, e2e는 모두 app adapter다. 이들은 command를 만들 수는 있지만
session state나 audio engine을 직접 수정하면 안 된다.

허용:

```ts
await appController.executeCommand({
  type: 'track.add',
});
```

금지:

```ts
sessionStore.setState(...);
trackController.addTrack();
audioEngine.start();
```

### 2. 원본 코드는 참고하되 구조는 재작성한다

원본에서 그대로 가져올 수 있는 것은 설정 파일의 일부와 테스트 시나리오다.

반면 다음은 v3 구조에 맞춰 다시 작성한다.

- `App.tsx`
- app provider
- CLI terminal command execution
- Web DAW UI
- e2e selector와 fixtures

### 3. e2e는 UI 구현 뒤에 붙인다

Playwright 테스트는 UI selector와 사용자 흐름에 강하게 의존한다.

따라서 먼저 stable한 app shell, terminal, track/timeline UI를 만든 뒤 e2e를
추가한다.

### 4. 배포 설정은 build 검증 뒤에 확정한다

Docker와 Netlify 설정은 `pnpm build`가 `dist/`를 안정적으로 만든 뒤 붙인다.

## Phase 1. React/Vite App Shell

### 목표

`drop-ai-v3`를 browser에서 실행 가능한 Vite React 앱으로 만든다.

### 작업

`package.json`에 React 관련 의존성을 추가한다.

- `react`
- `react-dom`
- `@vitejs/plugin-react`
- `@types/react`
- `@types/react-dom`

Vite 앱 entry를 추가한다.

- `index.html`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/vite-env.d.ts`

scripts를 정리한다.

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview"
}
```

### 완료 기준

```txt
pnpm install
pnpm typecheck
pnpm build
```

`dist/`가 생성되고 browser에서 빈 앱 shell이 열린다.

## Phase 2. React Composition Boundary

### 목표

React UI가 v3 app composition을 통해 controller와 session state에 접근하게 만든다.

### 작업

React provider와 hook을 추가한다.

예상 파일:

```txt
src/apps/web/AppProvider.tsx
src/apps/web/use-app-controller.ts
src/apps/web/use-session-state.ts
```

provider 책임:

- `createApp()` 호출
- `AppController` 제공
- `sessionReader.subscribe()`로 UI state 업데이트
- unmount 시 app dispose

UI 쓰기 작업은 항상 `AppController.executeCommand()`로만 실행한다.

### 완료 기준

- React component에서 현재 session state를 읽을 수 있다.
- button click으로 `track.add` command를 실행할 수 있다.
- session write가 UI component 안에서 직접 일어나지 않는다.

## Phase 3. CLI Terminal

### 목표

브라우저 UI 안에 `xterm` 기반 CLI terminal을 붙이고, 입력을 v3 CLI runner로
실행한다.

### 작업

필요 의존성:

- `xterm`
- `xterm-addon-fit`

예상 파일:

```txt
src/apps/web/cli/CliTerminal.tsx
src/apps/web/cli/format-command-result.ts
```

실행 흐름:

```txt
terminal input
  -> runCli(input, { appController })
  -> CommandResult
  -> terminal output
```

원본 `src/layers/apps/cli/ui/CliTerminal.tsx`는 xterm 초기화와 UX 참고용으로만
사용한다.

### 완료 기준

terminal에서 다음 명령이 동작한다.

```txt
track add
play
pause
stop
bpm 120
master 0.8
```

실패 command도 `CommandResult` error를 사람이 읽을 수 있는 문자열로 출력한다.

## Phase 4. Web UI

### 목표

v3 session model과 command schema에 맞는 기본 Web DAW UI를 만든다.

### 화면 구성

최소 구성:

- transport bar
- master controls
- track list
- region/timeline area
- asset upload
- CLI panel

권장 selector:

```txt
data-testid="app-shell"
data-testid="transport-play"
data-testid="transport-pause"
data-testid="transport-stop"
data-testid="track-list"
data-testid="track-row"
data-testid="timeline"
data-testid="asset-upload"
data-testid="cli-terminal"
```

### command 연결

UI action은 command로 매핑한다.

- play button -> `playback.play`
- pause button -> `playback.pause`
- stop button -> `playback.stop`
- add track -> `track.add`
- volume slider -> `track.volume.set`
- mute toggle -> `track.mute.set`
- solo toggle -> `track.solo.set`
- pan control -> `track.pan.set`
- file upload -> `asset.register`, 이후 `region.add`

### 완료 기준

- UI에서 track을 추가할 수 있다.
- UI에서 playback command를 실행할 수 있다.
- UI에서 track control command를 실행할 수 있다.
- CLI에서 실행한 command 결과가 UI session state에 반영된다.

## Phase 5. Playwright E2E

### 목표

원본 e2e 시나리오를 v3 UI와 command contract 기준으로 다시 만든다.

### 작업

설정 파일:

```txt
playwright.config.ts
```

scripts:

```json
{
  "test:e2e": "playwright test",
  "test": "pnpm test:unit && pnpm test:e2e"
}
```

초기 spec 후보:

```txt
e2e/app-smoke.spec.ts
e2e/cli.spec.ts
e2e/track-controls.spec.ts
e2e/playback.spec.ts
e2e/region.spec.ts
e2e/export.spec.ts
```

테스트 우선순위:

1. 앱이 로드되고 shell이 보인다.
2. CLI `track add`가 track list를 갱신한다.
3. CLI playback command가 성공 결과를 출력한다.
4. UI track controls가 command를 실행한다.
5. region add/move/split/resize/remove 흐름이 동작한다.
6. session export가 성공한다.

### 완료 기준

```txt
pnpm test:e2e
```

CI 환경에서는 Playwright retry와 worker 수를 보수적으로 설정한다.

## Phase 6. Docker

### 목표

개발용과 운영용 Docker 실행 경로를 복구한다.

### 작업

추가 파일:

```txt
Dockerfile
Dockerfile.dev
docker-compose.yml
nginx.conf
```

prod image:

```txt
node:22-alpine
  -> pnpm install --frozen-lockfile
  -> pnpm build
  -> nginx:alpine serves dist/
```

dev image:

```txt
pnpm dev --host 0.0.0.0
```

scripts:

```json
{
  "docker:build": "docker build -t drop-ai-v3 .",
  "docker:build:dev": "docker build -f Dockerfile.dev -t drop-ai-v3:dev .",
  "docker:run": "docker run -p 8080:80 drop-ai-v3",
  "docker:run:dev": "docker run -p 5173:5173 -v $(pwd):/app drop-ai-v3:dev",
  "docker:compose:dev": "docker compose up app-dev",
  "docker:compose:prod": "docker compose up app-prod",
  "docker:compose:down": "docker compose down"
}
```

### 완료 기준

```txt
docker build -t drop-ai-v3 .
docker run -p 8080:80 drop-ai-v3
```

`http://localhost:8080`에서 app shell이 열린다.

## Phase 7. Netlify

### 목표

Netlify에서 Vite SPA로 배포 가능하게 만든다.

### 작업

추가 파일:

```txt
netlify.toml
```

기본 설정:

```toml
[build]
  command = "pnpm build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

필요하면 header 설정을 추가한다.

- `X-Content-Type-Options = "nosniff"`
- wasm MIME type
- static asset cache

### 완료 기준

```txt
pnpm build
```

Netlify build command가 같은 결과를 만든다.

## Phase 8. Final Verification

최종 검증 순서:

```txt
pnpm install
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm build
pnpm test:e2e
docker build -t drop-ai-v3 .
```

가능하면 추가로 확인한다.

```txt
pnpm preview
docker run -p 8080:80 drop-ai-v3
```

## 권장 작업 순서

1. React/Vite app shell
2. React composition boundary
3. CLI terminal
4. 기본 Web UI
5. Playwright e2e
6. Docker
7. Netlify
8. 전체 검증

## 완료 정의

마이그레이션은 다음 조건을 만족할 때 완료로 본다.

- `drop-ai-v3`에서 browser app이 실행된다.
- UI와 CLI terminal이 같은 `AppController.executeCommand()` 경로를 사용한다.
- Playwright e2e가 주요 사용자 흐름을 검증한다.
- `pnpm build`가 `dist/`를 만든다.
- Docker prod image가 app을 serve한다.
- Netlify가 `dist/`를 publish할 수 있다.
- 원본 `src/layers` 구조가 v3에 다시 섞이지 않는다.

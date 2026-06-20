# ToneAudioEngine Web Composition 연결 작업 로그

## Phase 1. 범위 확인

- 날짜: 2026-06-19
- 요청: docs 기준 우선순위 1번인 `ToneAudioEngine` 기본 Web composition 연결을 진행한다.
- 확인 내용:
  - 현재 `createApp()` 기본 audio engine은 `FakeAudioEngine`이다.
  - Web `AppProvider`는 기본 실행 경로에서 `createApp()`을 호출한다.
  - `apps` 레이어는 `audio-engine`을 직접 import할 수 없으므로 실제 엔진 선택은 composition 경계에서 처리해야 한다.
  - 테스트는 계속 `FakeAudioEngine`을 명시 주입하는 방식으로 유지한다.
- 다음 작업:
  - composition 기본 audio engine을 `ToneAudioEngine`으로 전환한다.
  - 브라우저 autoplay 정책에 맞게 `ToneAudioEngine.play()`에서 Tone audio context start를 보장한다.
  - 관련 테스트와 현재 상태 문서를 갱신한다.

## Phase 2. 구현

- `createApp()`의 기본 audio engine을 `FakeAudioEngine`에서 `ToneAudioEngine`으로 변경했다.
- `ToneAudioEngine.play()`가 Transport를 시작하기 전에 `tone.start()`를 await하도록 변경했다.
  - 브라우저 autoplay 정책 때문에 첫 사용자 제스처 이후 audio context resume이 필요할 수 있어서 재생 경계에 포함했다.
- `AppProvider` 관련 테스트는 제품 기본 엔진에 의존하지 않도록 `FakeAudioEngine`을 명시 주입했다.
- `ToneAudioEngine` transport 테스트는 audio context start 호출을 함께 검증하도록 보강했다.
- README, docs README, 프로젝트 정체성, CLI 가이드의 현재 상태와 다음 우선순위를 갱신했다.

다음 작업:

- 타입체크, 린트, 빌드를 실행해 기본 품질 게이트를 확인한다.
- 변경된 테스트 경로도 함께 확인한다.

## Phase 3. 검증

- `pnpm typecheck`: 통과
- `pnpm lint`: 통과
- `pnpm build`: 통과
  - Vite가 production build를 완료했다.
  - 메인 chunk가 500 kB를 넘어 chunk size warning이 출력되었지만 빌드는 성공했다.
- `pnpm test`: 통과
  - 31개 test file, 232개 test가 통과했다.

확인 결과:

- `ToneAudioEngine` 기본 연결은 TypeScript, ESLint, production build, unit test 기준에서 문제가 없었다.
- 실제 브라우저에서 업로드한 오디오가 들리는지 확인하는 수동 QA는 다음 phase의 작업으로 남긴다.

다음 작업:

- 변경 파일을 최종 확인하고 커밋한다.

## Phase 4. 커밋 준비

- `git diff --check`: 통과
- 변경 범위:
  - 기본 app composition의 audio engine 선택 변경
  - Tone 재생 경계의 audio context start 보강
  - 관련 테스트 갱신
  - 현재 상태/로드맵 문서 갱신
  - 작업 로그 추가
- `work-log`는 `.gitignore`에 포함되어 있으므로 이번 요청 범위의 기록 파일은 `git add -f`로 커밋에 포함한다.

# Drop AI v3 Docs

이 디렉터리는 Drop AI v3의 설계 기록과 실행 계획을 모아둔다.

현재 제품 목표는 command-first 구조 자체를 검증하는 것이 아니라, 브라우저에서 실제 오디오 파일을 업로드하고 재생하고 편집하고 WAV로 export할 수 있는 lightweight DAW를 만드는 것이다.

`command-first`는 목표가 아니라 내부 설계 원칙이다. Web UI, 인앱 CLI, 향후 keyboard shortcut, agent, plugin 입력이 같은 편집 코어를 공유하도록 모든 쓰기 입력을 `AppController.executeCommand()` 경계로 통과시킨다.

## 현재 기준 문서

현재 의사결정의 기준은 아래 문서를 우선한다.

- [README.md](../README.md): 제품 목표, 현재 구현 범위, 실행 방법, roadmap
- [ARCHITECTURE.md](../ARCHITECTURE.md): 현재 레이어 책임과 command boundary
- [src/discipline.md](../src/discipline.md): 코드 레이어 규칙
- [PROJECT_IDENTITY.md](./PROJECT_IDENTITY.md): 프로젝트 정체성
- [discipline.md](./discipline.md): docs 안에 남겨둔 레이어 규칙 사본
- [cli-guide.md](./cli-guide.md): 현재 인앱 CLI 사용 가이드

## 과거 계획 문서

아래 문서는 구현 과정의 기록이다. 현재 roadmap과 다를 수 있으므로 그대로 실행 계획으로 사용하지 않는다.

- [FINAL_DESIGN_AND_PLAN.md](./FINAL_DESIGN_AND_PLAN.md)
- [migration-ui-cli-e2e-deploy-plan.md](./migration-ui-cli-e2e-deploy-plan.md)
- [mvp-upload-cli-export-plan.md](./mvp-upload-cli-export-plan.md)
- [rebuild-execution-plan.md](./rebuild-execution-plan.md)
- [rebuild-plan.md](./rebuild-plan.md)
- [rebuild-step-by-step.md](./rebuild-step-by-step.md)

## 현재 우선순위

1. `ToneAudioEngine`을 기본 Web composition에 연결한다.
2. 업로드한 오디오 파일이 실제로 재생되는지 확인한다.
3. play, pause, stop, seek를 CLI와 UI에서 같은 command로 실행한다.
4. export한 WAV가 실제 오디오를 담는지 확인한다.
5. 최소 transport UI와 timeline/region 표시를 추가한다.
6. IndexedDB 기반 프로젝트 저장/복원을 추가한다.

# Phase 1 다음 구현 플랜

> 2026-07-09 상태 업데이트: 이 문서는 Phase 1 planner provider 작업 전 작성한 계획이다. 현재 `main`에는
> `HttpAgentPlanner`, `WebLLMAgentPlanner`, `VITE_AGENT_PLANNER_PROVIDER` 기반 provider selection이 들어가 있다.
> Web path의 기본 provider는 `webllm`이며, `scripted`는 명시 설정할 때만 사용하는 deterministic test/dev fallback이다.
> 최신 구현 기록은 `docs/work-log/agent/agent.md`의 "WebLLM Agent Planner와 Provider Selection 연결" 섹션과
> "2026-07-09 main 재적용 결과" 섹션을 기준으로 본다.

## 목적

Phase 1을 scripted planner 기반 데모에서 실제 planner provider를 연결할 수 있는 MVP workflow로 마무리한다.

여기서 **planner provider**는 `requestText`, `sessionSummary`, `commandCatalog`를 입력으로 받아 `AgentPlanDraft`
형태의 JSON-compatible command 후보를 반환하는 외부 실행 주체를 뜻한다. 이 provider는 command를 직접 실행하지
않고, command 실행은 계속 `AppController.executeCommand()`만 담당한다.

## 현재 근거

### 사실

- `docs/spec.md`는 Phase 1 종료 시점을 MVP 완료 기준으로 정의한다.
- Phase 1 MVP의 핵심은 사용자가 현재 session을 이해한 command plan을 preview하고, 승인한 command만 실행해서
  오디오 편집과 WAV export를 수행하는 것이다.
- 현재 코드에는 `AgentWorkflow`, `agentCommandCatalog`, `createAgentSessionSummary()`, `AgentAuditLog`,
  `ScriptedAgentPlanner`, `AgentPanel`이 있다.
- 현재 `AgentPanel`은 request 입력, plan preview, approve, reject, execution result message를 제공한다.
- 현재 기본 planner인 `createDefaultAgentPlanner()`는 request text를 trim/lowercase한 뒤 미리 정의된 script key와
  매칭한다.
- 현재 repository에는 `src/apps/agent/planner-adapters/` 디렉터리와 외부 provider 호출 adapter가 없다.
- 현재 `AgentWorkflow.requestPlan()`은 `planner.createPlan()`에서 throw 또는 rejected Promise가 발생하는 경우를
  내부에서 `RequestAgentPlanResult`로 변환하지 않는다.
- 현재 `AgentPanel.requestPlan()`은 `agentWorkflow.requestPlan()`의 rejected Promise를 `catch` 또는 `finally`로
  처리하지 않는다.
- `docs/spec.md`의 Phase 1 체크박스 중 자연어 입력, plan preview, 사용자 승인 UI는 현재 코드 기준과 일치하지
  않는다. 현재 코드 기준으로는 해당 UI가 이미 존재한다.

### 추론

- 다음 구현의 첫 단위는 외부 provider 연결 자체가 아니라 planner 실패 경계를 명시하는 작업이어야 한다.
- 이유는 provider timeout, network error, invalid response는 실제 provider를 붙이는 순간 정상적인 실패 경로가 되기
  때문이다.
- 현재 scripted planner는 제한된 문자열 매칭이다. 이것은 free-form 자연어 의미 해석이 아니라 deterministic command
  plan lookup에 가깝다.
- Phase 1 MVP를 완료하려면 scripted planner를 유지하더라도, 외부 provider를 붙일 수 있는 adapter 경계와 실패
  표시가 필요하다.
- 브라우저 앱이 private API key를 직접 소유하는 구조는 안전하지 않다. 외부 LLM provider를 사용할 경우 browser는
  private key가 아니라 server-side planner endpoint와 통신해야 한다.

### 가정

- 다음 phase는 Phase 2 waveform UI가 아니라 Phase 1 agent MVP 마무리다.
- provider 종류는 아직 고정하지 않는다.
- MVP에서는 raw audio binary, `File`, `Blob`, object URL을 provider input에 보내지 않는다.
- MVP에서는 command result를 다음 command payload에서 참조하는 symbolic reference를 지원하지 않는다.
- MVP에서는 command 일부가 성공한 뒤 뒤 command가 실패해도 rollback하지 않는다. rollback은 Phase 4 undo/redo
  설계와 별도 문제로 둔다.

## 용어 정의

- **Scripted planner**: request text를 deterministic key로 매칭해서 미리 정의된 `AgentPlanDraft`를 반환하는
  `IAgentPlanner` 구현체.
- **External planner adapter**: 외부 planner provider를 호출하지만 `IAgentPlanner` 인터페이스만 노출하는 adapter.
- **Planning failure**: command 실행 전 단계에서 plan을 만들지 못한 상태. provider timeout, network error, invalid
  provider response, adapter exception이 여기에 포함된다.
- **Plan validation failure**: planner가 반환한 draft는 존재하지만 `commandSchema.safeParse()` 또는 plan shape 검증을
  통과하지 못한 상태.
- **Execution failure**: 승인된 command가 `AppController.executeCommand()`를 통과한 뒤 `ok: false`를 반환한 상태.

## 구현 순서

### PR 1. Planner 실패 경계 정리

목표: provider가 throw 또는 reject하더라도 UI가 멈추지 않고 planning failure를 사용자에게 표시한다.

변경 범위:

- `AgentWorkflow.requestPlan()`에서 `planner.createPlan()` 실패를 `RequestAgentPlanResult`의 실패 variant로 변환한다.
- 실패 code는 validation 실패와 구분되는 값으로 둔다. 예: `AGENT_PLANNER_FAILED`.
- audit log에 `plan_failed` 또는 별도 planning failure event를 남긴다. event name은 기존 `AgentAuditEntry` union과
  호환되게 결정한다.
- `AgentPanel.requestPlan()`에 `try/finally`를 적용해 rejected Promise가 발생해도 pending state를 해제한다.
- 사용자-facing message는 provider 내부 error object를 그대로 노출하지 않고 요약된 message만 표시한다.

테스트:

- planner가 throw하면 command가 실행되지 않는다.
- planner가 rejected Promise를 반환하면 `AgentPanel`이 error message를 표시한다.
- planner 실패 후 `Plan` button이 다시 활성화된다.
- audit log에 실패 event가 남는다.

PR 제목 후보:

```text
fix(agent): handle planner request failures
```

### PR 2. Provider-agnostic HTTP planner adapter

목표: provider 종류를 고정하지 않고 browser가 호출할 수 있는 HTTP planner endpoint adapter를 추가한다.

변경 범위:

- `src/apps/agent/planner-adapters/http-agent-planner.ts`를 추가한다.
- adapter는 `IAgentPlanner`를 구현한다.
- adapter input은 `AgentPlanningInput`에서 온 `requestText`, `sessionSummary`, agent-available command catalog만
  포함한다.
- `availability: 'requiresUserAttachment'` command는 provider가 직접 생성할 수 없다는 metadata를 유지하되, raw
  `File`은 보내지 않는다.
- adapter output은 신뢰하지 않고 기존 `validateAgentPlanDraft()` 경계로 넘긴다.
- timeout은 `AbortController`로 처리한다. 이 timeout은 중복 요청 제거가 아니라 단일 provider request의 최대 대기
  시간 제한이다.
- non-2xx HTTP response, JSON parse 실패, response shape 누락을 planning failure로 변환한다.

테스트:

- 성공 response가 `AgentPlanDraft`로 반환된다.
- non-2xx response가 planning failure로 변환된다.
- invalid JSON이 planning failure로 변환된다.
- timeout이 planning failure로 변환된다.
- request body에 raw `File` 또는 `Blob`이 포함되지 않는다.

PR 제목 후보:

```text
feat(agent): add HTTP planner adapter
```

### PR 3. Web composition에서 planner 선택 연결

목표: 기본 scripted planner를 유지하면서, 설정이 있을 때 HTTP planner adapter를 사용할 수 있게 한다.

변경 범위:

- `createDefaultAgentPlanner()`가 기본값으로 scripted planner를 반환하는 현재 동작은 유지한다.
- public endpoint URL이 설정된 경우에만 HTTP planner adapter를 생성한다.
- browser bundle에 private API key를 넣지 않는다.
- endpoint URL은 private secret이 아니어야 한다. provider key는 server-side endpoint가 소유해야 한다.
- test에서는 계속 `createAgentPlanner` prop으로 deterministic planner를 주입한다.

테스트:

- 설정이 없으면 scripted planner가 사용된다.
- endpoint 설정이 있으면 HTTP planner adapter가 사용된다.
- AppProvider test는 실제 network call 없이 fake planner 또는 fake fetch로 검증한다.

PR 제목 후보:

```text
feat(agent): configure web planner adapter
```

### PR 4. Phase 1 상태 동기화와 수동 QA 기록

목표: 구현 상태와 `docs/spec.md`의 체크박스를 맞추고, Phase 1 MVP 검증 절차를 문서화한다.

변경 범위:

- `docs/spec.md`의 Phase 1 체크 상태를 현재 코드 기준으로 갱신한다.
- scripted planner로만 가능한 항목과 external planner adapter가 있어야 완료되는 항목을 구분한다.
- 수동 QA 절차를 work-log에 추가한다.

수동 QA:

1. 오디오 파일을 업로드한다.
2. agent request에 "1초부터 3초까지만 들려줘"에 해당하는 요청을 입력한다.
3. export range start/end와 preview command가 preview에 표시되는지 확인한다.
4. approve 후 preview playback이 실행되는지 확인한다.
5. "이 구간을 WAV로 내보내줘"에 해당하는 요청을 입력한다.
6. approve 후 WAV download가 시작되는지 확인한다.
7. provider 실패 또는 endpoint 미설정 시 사용자-facing error가 표시되는지 확인한다.

PR 제목 후보:

```text
docs(spec): sync phase 1 agent status
```

## 구현하지 않을 것

- Phase 2 waveform timeline UI.
- region drag selection UI.
- keyboard shortcut.
- undo/redo.
- project save/load.
- browser bundle에 private provider API key 저장.
- provider prompt 또는 raw provider response를 audit log에 저장.
- raw audio binary를 provider input에 포함.

## 완료 기준

- provider 실패가 UI에서 recoverable error로 표시된다.
- planning failure, plan validation failure, execution failure가 타입과 사용자 메시지에서 구분된다.
- HTTP planner adapter가 `IAgentPlanner`만 구현하고 command를 직접 실행하지 않는다.
- external planner가 만든 command도 preview 전에 기존 `commandSchema` 검증을 통과해야 한다.
- approved command만 `AppController.executeCommand()`를 통과한다.
- browser에는 private provider key가 포함되지 않는다.
- scripted planner fallback이 유지된다.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`가 통과한다.

## 남은 결정

- 실제 provider는 어떤 서비스 또는 모델을 사용할 것인가.
- server-side planner endpoint를 이 repository에 둘 것인가, 별도 서비스로 둘 것인가.
- HTTP planner endpoint의 request/response schema를 별도 versioned contract로 둘 것인가.
- audit log를 Phase 4 project save/load 대상에 포함할 것인가, session-local workflow record로 둘 것인가.

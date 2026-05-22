# 아키텍처

## 입력 경로 단일화

이 프로젝트는 DAW(Digital Audio Workstation)다. Web UI, CLI, 키보드 단축키, AI agent, 테스트 코드 — 입력 경로가 다섯 갈래로 늘어난다. 각 경로가 controller를 직접 호출하던 구조에서는 같은 의도(예: 트랙 추가)가 경로마다 다른 검증·다른 분기·다른 사이드이펙트를 만들었다.

해결책은 단순하다. **모든 입력은 `AppController.executeCommand(rawCommand)`라는 단 하나의 진입점을 거친다.** rawCommand는 Zod로 검증되고, `CommandController`가 도메인별 controller로 분기한다. 입력 경로가 추가되어도 검증/분기 코드를 다시 짤 필요가 없다.

```
Apps (Web UI · CLI · Keyboard · AI Agent · Test)
  └─ AppController.executeCommand(rawCommand)
       └─ CommandController (Zod 검증 + 분기)
            ├─ PlaybackController            → IAudioEngine + SessionStore
            ├─ TrackController               → IAudioEngine + SessionStore + AssetRegistry
            ├─ AssetController               → AssetRegistry
            └─ SessionPersistenceController  → ISessionRepository + DirtyTracker
```

## 레이어 규칙

- `tone` import는 `audio-engine.ts` 안에서만 한다.
- IndexedDB는 `IndexedDBSessionRepository` adapter 안에서만 의존한다.
- React 컴포넌트는 `useController()` / `useSession()` 훅으로만 도메인에 접근한다.
- UI 이벤트 핸들러는 controller 메서드를 직접 부르지 않고 `controller.executeCommand({ type: ... })`만 호출한다.
- 도메인 controller(Playback/Track/Asset/Persistence)는 자기 책임만 가지며 다른 controller를 직접 알지 않는다. 합성은 `AppController`와 `CommandController`가 책임진다.

## 핵심 결정 세 가지

### 1. 모든 도메인은 TDD로 재구현한다

이전 프로토타입(`drop-ai`)에 동작하는 코드가 있어도 그대로 복사하지 않는다. 시그니처와 알고리즘은 참고하되 Red → Green → Refactor 사이클로 다시 쓴다. 테스트가 곧 명세이며, 테스트 없이 들어온 코드는 없다고 본다.

### 2. Asset은 별도 레이어로 둔다

오디오 파일은 `AssetRegistry`에 등록되어 `assetId`를 받는다. region은 파일을 직접 가지지 않고 `assetId`만 참조한다.

- `region.add` command는 `{ trackId, assetId, startTime }`만 받아 직렬화가 깔끔하다 (CLI/agent 친화적).
- 동일 파일이 여러 region에 쓰여도 `Tone.AudioBuffer` 한 개만 메모리에 둘 수 있다.
- 세션 저장 시 region에는 assetId만, asset 메타데이터는 별도 store에 — BLOB 인라인을 피한다.
- UI 드래그앤드롭은 `asset.register` → `region.add` 두 command를 순차 발행한다.

### 3. UI도 `executeCommand`만 쓴다

Transport, TrackList, region 편집 — 어떤 React 컴포넌트도 `controller.playback.handlePlay()` 형태로 controller를 직접 호출하지 않는다. UI는 명령을 의도로 표현하고, 검증·분기·실행은 도메인 레이어가 책임진다. 키보드·CLI·agent와 동일한 검증 경로를 UI에도 강제한다.

## 왜 command 중심인가

세 가지 효과가 있다.

- **검증 일관성**: 잘못된 페이로드는 Zod에서 한 번에 걸린다. controller 메서드 시그니처에 의존한 ad-hoc 검증이 사라진다.
- **재현 가능성**: command는 직렬화 가능한 plain object다. 같은 command 시퀀스를 다시 재생하면 같은 상태가 나온다. undo/redo, replay, agent의 dry-run에 모두 유리하다.
- **확장 비용 0**: 새 입력 경로(예: MIDI 컨트롤러, WebSocket remote)를 붙일 때 도메인 controller를 건드릴 필요가 없다. command를 만들어 `executeCommand`에 넘기기만 하면 된다.

# drop-ai-v3 Rebuild — 사람이 작업하는 순서 (Step-by-Step Execution)

## Context

`drop-ai` (Tone.js + React + Zustand 기반 웹 오디오 편집기)를 `drop-ai-v3`로 command-first 구조로 다시 세우는 실행 계획이다.

이 문서는 같은 디렉터리에 있는 `rebuild-execution-plan.md`의 **대체가 아니라 보완**이다. 그 문서는 milestone 단위로 "왜/무엇을"을 정한 설계 가이드이고, 이 문서는 그것을 **사람이 한 번에 한 가지 일에 집중할 수 있는 atomic step 단위**로 분해한 실행 매뉴얼이다.

- 작업 경로: `/Users/whizzkid/Documents/whizzkid/drop-ai-v3`
- 참조 구현: `/Users/whizzkid/Documents/HURREAY/code/drop-ai` (이하 "원본")

### 절대 원칙 (변경 불가)

1. 모든 실행은 `appController.executeCommand` 통과
2. command schema validation은 실행보다 앞선다
3. `core/`는 DOM/Tone/IndexedDB를 모른다
4. Tone.js import는 `audio/tone/` 안에서만
5. IndexedDB 접근은 `storage/indexeddb/` 안에서만
6. session write는 controller만. apps는 read-only
7. TDD: Red → Green → Refactor → Commit

### 데이터 모델 결정

session state의 tracks/regions는 **normalized object map + order array**로 잡는다. 원본의 `Map<string, TrackState>`는 JSON serialize, dirty comparison, Zustand update detection이 불편하고, `TrackState[]`만으로는 `trackId` 접근이 매번 `find()`라 도메인 operation이 지저분해진다.

```ts
interface SessionState {
  id: string;
  trackOrder: string[];
  tracksById: Record<string, TrackState>;
  playback: PlaybackState;
  dirty: boolean;
  updatedAt: string;
}

interface TrackState {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  soloed: boolean;
  pan: number;
  regionOrder: string[];
  regionsById: Record<string, RegionState>;
}

interface RegionState {
  id: string;
  assetId: string; // 원본의 Blob URL이 아니라 추상 식별자. audio adapter만 Blob URL을 안다.
  startTime: number;
  duration: number;
  offset: number;
}

interface PlaybackState {
  playing: boolean;
  positionSeconds: number;
  bpm: number;
  masterVolume: number;
  loop: { start: number; end: number; enabled: boolean };
}
```

규칙:

- 추가는 `tracksById[id]`에 넣고 `trackOrder`에 push.
- 제거는 둘 다에서 삭제. region도 동일.
- reorder는 `trackOrder`/`regionOrder`만 바뀜.
- core operation은 input state를 mutate하지 않고 새 state를 반환.

---

## Phase 구성 한 줄 요약

- **A. 환경 확인** (Step 1–2)
- **B. Architecture Guard** (Step 3–5) — 잘못된 import를 미리 막는다
- **C. Core Session Model** (Step 6–13) — DOM/Tone 없이 검증 가능
- **D. Storage 인터페이스 + Memory** (Step 14–16)
- **E. AudioProvider 인터페이스 + Fake** (Step 17–19)
- **F. Domain Controllers** (Step 20–28)
- **G. Composition Root + in-memory e2e** (Step 29–31) — 첫 데모 가능 지점
- **H. Tone Audio Adapter** (Step 32–34)
- **I. IndexedDB + Autosave** (Step 35–39) — UI 없이 reload recovery 검증
- **J. Web UI Adapter** (Step 40–45)
- **K. Keyboard Adapter** (Step 46–47)
- **L. Agent Adapter** (Step 48–50) — rule-based first
- **M. Input Equivalence & E2E Recovery** (Step 51–53)

각 phase 끝에 **체크포인트**: `pnpm test`와 `pnpm typecheck`가 모두 통과해야 다음 phase로.

---

## Step 형식

각 step은 다음을 포함한다.

- **목표**: 한 문장
- **선행 조건**: 이전 step
- **먼저 쓸 실패 테스트**: 파일/케이스
- **최소 구현**: 만들/수정할 파일
- **완료 조건**: 통과해야 할 명령
- **커밋 메시지**: 제안
- **소요**: S (<30분) / M (30분~2시간) / L (2시간 이상)

---

## Phase A — 환경 확인

### Step 1. baseline 테스트와 typecheck를 돌려본다

- **목표**: 작업 시작 전 v3가 알려진 녹색 상태인지 확인
- **선행 조건**: 없음
- **먼저 쓸 실패 테스트**: 없음
- **최소 구현**: `pnpm install`
- **완료 조건**: `pnpm install && pnpm test && pnpm typecheck` 통과
- **커밋 메시지**: 없음
- **소요**: S

### Step 2. 이 문서를 git에 등록한다

- **목표**: 문서가 추적되는 상태인지 확인
- **선행 조건**: Step 1
- **먼저 쓸 실패 테스트**: 없음
- **최소 구현**: `docs/rebuild-step-by-step.md` (이 문서) 자체. `docs/rebuild-execution-plan.md`는 그대로 둠
- **완료 조건**: `git status`에 untracked로 나타나거나 이미 staged
- **커밋 메시지**: `docs(rebuild): add step-by-step execution plan`
- **소요**: S

---

## Phase B — Architecture Guard

### Step 3. tone import boundary 테스트를 추가한다

- **목표**: `tone`이 `src/layers/audio/tone/` 밖에서 import되면 테스트가 빨갛게 됨
- **선행 조건**: Step 2
- **먼저 쓸 실패 테스트**: `src/layers/testing/architecture-boundary.test.ts`
  - `does not import tone from controllers/`
  - `does not import tone from core/`
  - `does not import tone from apps/`
  - `allows tone import only from audio/tone/`
- **최소 구현**: `fs.readdirSync` recursion으로 src 트리를 걸어 각 파일 안에 `from 'tone'` / `import 'tone'`를 검사
- **완료 조건**: 해당 테스트 통과 (Tone 코드가 아직 없으므로 위반 0개)
- **커밋 메시지**: `test(architecture): lock tone import boundary`
- **소요**: M

### Step 4. indexedDB / `idb` / `fake-indexeddb` boundary 케이스를 추가한다

- **목표**: indexedDB 접근이 `storage/indexeddb/` 밖에서 등장하면 실패
- **선행 조건**: Step 3
- **먼저 쓸 실패 테스트**: 같은 boundary 파일에 추가
  - `does not reference indexedDB outside storage/indexeddb/`
  - `does not import 'idb' or 'fake-indexeddb' outside storage/indexeddb/`
- **최소 구현**: 같은 파일에 검사 추가
- **완료 조건**: 통과
- **커밋 메시지**: `test(architecture): lock indexeddb import boundary`
- **소요**: S

### Step 5. apps → controllers 단방향 import boundary를 추가한다

- **목표**: `apps/`에서 `core/`, `audio/`, `storage/`로 직접 들어가는 import를 막는다
- **선행 조건**: Step 4
- **먼저 쓸 실패 테스트**: 같은 파일에 추가
  - `apps do not import from layers/core directly`
  - `apps do not import from layers/audio directly`
  - `apps do not import from layers/storage directly`
  - `apps only import from layers/controllers or layers/testing`
- **최소 구현**: 같은 파일에 케이스 추가. allow-list: `controllers`, `testing`
- **완료 조건**: 통과
- **커밋 메시지**: `test(architecture): enforce apps depend only on controllers`
- **소요**: S

> **체크포인트 (Phase B 끝)**: `pnpm test && pnpm typecheck` 통과. 앞으로 추가되는 모든 코드가 이 boundary에 의해 자동으로 강제된다.

---

## Phase C — Core Session Model

### Step 6. SessionState/TrackState/RegionState 타입과 `createEmptySession`을 정의한다

- **목표**: normalized 구조를 fixture-first로 못박는다
- **선행 조건**: Step 5
- **먼저 쓸 실패 테스트**: `src/layers/core/session/session-state.test.ts`
  - `creates an empty session with deterministic defaults`
  - `default session has trackOrder = [], tracksById = {}, bpm = 120, masterVolume = 1`
  - `playback.playing is false initially`
- **최소 구현**: `src/layers/core/session/session-state.ts`
  - `SessionState`, `TrackState`, `RegionState`, `PlaybackState` 인터페이스
  - `createEmptySession({ id, now }): SessionState`
- **완료 조건**: `pnpm test src/layers/core/session/session-state.test.ts` 통과
- **커밋 메시지**: `feat(core): define normalized session state types`
- **참조**: 원본 `src/layers/session/session.ts` 타입은 참고만. Map 구조는 옮기지 않음
- **소요**: M

### Step 7. `addTrack` operation을 정의한다

- **목표**: `addTrack(state, { id, name }): SessionState`가 기본 mixer 값으로 트랙을 추가
- **선행 조건**: Step 6
- **먼저 쓸 실패 테스트**: `src/layers/core/session/session-operations.test.ts`
  - `addTrack adds id to trackOrder and creates entry in tracksById with default mixer values`
  - `addTrack does not mutate input state`
  - `addTrack marks dirty true`
  - `addTrack updates updatedAt to provided now`
- **최소 구현**: `src/layers/core/session/session-operations.ts`에 `addTrack`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(core): add addTrack operation`
- **소요**: S

### Step 8. `removeTrack` operation을 정의한다

- **목표**: 트랙과 그 region을 모두 제거
- **선행 조건**: Step 7
- **먼저 쓸 실패 테스트**: 같은 파일에 케이스 추가
  - `removeTrack removes trackId from trackOrder and tracksById`
  - `removeTrack also drops all regions of that track (regionsById entries gone)`
  - `removeTrack throws TrackNotFoundError when trackId missing`
- **최소 구현**: `removeTrack` 함수 + `src/layers/core/session/session-errors.ts`에 `TrackNotFoundError`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(core): add removeTrack operation with domain error`
- **소요**: S

### Step 9. track mixer (volume/mute/solo/pan) operations를 정의한다

- **목표**: 4개 operation 추가
- **선행 조건**: Step 8
- **먼저 쓸 실패 테스트**: 같은 파일
  - `setTrackVolume / setTrackMute / setTrackSolo / setTrackPan 각각 tracksById[id] 필드 갱신`
  - `each marks dirty`
  - `each throws TrackNotFoundError on missing track`
- **최소 구현**: 4 operation 함수
- **완료 조건**: 통과
- **커밋 메시지**: `feat(core): add track mixer operations`
- **소요**: M

### Step 10. `addRegion` operation을 정의한다

- **목표**: 트랙에 region 추가. duration은 controller가 audio provider에서 받아 넘긴다
- **선행 조건**: Step 9
- **먼저 쓸 실패 테스트**: 같은 파일
  - `addRegion adds regionId to track.regionOrder and creates entry in track.regionsById`
  - `addRegion throws TrackNotFoundError when track missing`
  - `addRegion marks dirty`
- **최소 구현**: `addRegion(state, { trackId, regionId, assetId, startTime, duration, offset })`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(core): add addRegion operation`
- **소요**: S

### Step 11. region move / resize / remove operations를 정의한다

- **목표**: 3개 operation
- **선행 조건**: Step 10
- **먼저 쓸 실패 테스트**:
  - `moveRegion updates startTime`
  - `resizeRegion updates duration`
  - `resizeRegion rejects non-positive duration`
  - `removeRegion removes from regionOrder and regionsById`
  - `removeRegion throws RegionNotFoundError on missing region`
- **최소 구현**: 3 함수 + `RegionNotFoundError`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(core): add region move/resize/remove operations`
- **소요**: M

### Step 12. `splitRegion` operation을 정의한다

- **목표**: splitTime에서 region을 두 개로 분리. id 두 개를 외부에서 받는다 (left는 원래 id 유지, right는 newRegionId)
- **선행 조건**: Step 11
- **먼저 쓸 실패 테스트**:
  - `splitRegion produces left with same id, duration = splitTime - startTime, offset unchanged`
  - `splitRegion produces right with newRegionId, startTime = splitTime, offset = original.offset + (splitTime - startTime)`
  - `right is inserted right after left in regionOrder`
  - `rejects split at or before region start`
  - `rejects split at or after region end`
- **최소 구현**: `splitRegion(state, { trackId, regionId, splitTime, newRegionId })`
- **참조**: 원본 `src/layers/controllers/track-controller.ts`의 split offset 계산을 그대로 차용. 단, ID 생성은 외부 주입
- **완료 조건**: 통과
- **커밋 메시지**: `feat(core): add region split operation`
- **소요**: M

### Step 13. playback operations 7개를 정의한다

- **목표**: setPlaying, setPosition, setBpm, setMasterVolume, setLoop, (loop start/end는 setLoop가 함께 받음)
- **선행 조건**: Step 12
- **먼저 쓸 실패 테스트**:
  - `setPlaying does NOT mark dirty` (재생은 편집이 아님)
  - `setBpm rejects non-positive bpm`
  - `setMasterVolume rejects out of [0,1]`
  - `setLoop rejects end <= start when enabled`
  - `setBpm / setMasterVolume / setLoop mark dirty`
  - `setPosition does NOT mark dirty`
- **최소 구현**: 7개 함수
- **완료 조건**: 통과
- **커밋 메시지**: `feat(core): add playback operations`
- **소요**: M

> **체크포인트 (Phase C 끝)**:
> - `pnpm test src/layers/core/` 모두 통과
> - 이 phase의 모든 테스트는 jsdom의 `window`/`document`를 건드리지 않는다 (손으로 점검)

---

## Phase D — Storage 인터페이스 + Memory

### Step 14. `SessionStorageProvider` interface를 정의한다

- **목표**: `loadLatest()`, `save(session)`, `clear()` 시그니처 확정
- **선행 조건**: Step 13
- **먼저 쓸 실패 테스트**: 없음 (interface만)
- **최소 구현**: `src/layers/storage/session-storage-provider.ts`
- **완료 조건**: `pnpm typecheck` 통과
- **커밋 메시지**: `feat(storage): define session storage provider interface`
- **소요**: S

### Step 15. `MemorySessionStorage`를 구현한다

- **목표**: 인메모리 구현. controller/autosave 테스트에서 사용
- **선행 조건**: Step 14
- **먼저 쓸 실패 테스트**: `src/layers/storage/memory-session-storage.test.ts`
  - `loadLatest returns null when nothing saved`
  - `save then loadLatest returns saved snapshot`
  - `save overwrites previous snapshot`
  - `clear empties storage`
  - `save deep-clones session (structuredClone) so external mutation does not leak`
- **최소 구현**: `src/layers/storage/memory-session-storage.ts`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(storage): implement memory session storage`
- **소요**: S

### Step 16. storage contract helper로 묶는다

- **목표**: IndexedDB adapter도 같은 동작을 따르도록 공유 시나리오 추출
- **선행 조건**: Step 15
- **먼저 쓸 실패 테스트**: `src/layers/storage/session-storage-provider.contract.ts`에 `runSessionStorageContract(label, factory)` 정의. `memory-session-storage.test.ts`가 이걸 호출하도록 리팩토링
- **최소 구현**: contract 헬퍼. memory test 리팩토링
- **완료 조건**: 통과
- **커밋 메시지**: `refactor(storage): extract storage contract shared scenarios`
- **소요**: S

> **체크포인트 (Phase D 끝)**: `pnpm test src/layers/storage/` 통과

---

## Phase E — AudioProvider 인터페이스 + Fake

### Step 17. `AudioProvider` interface를 정의한다

- **목표**: controller가 호출할 모든 audio side effect를 한 곳에 모은다
- **선행 조건**: Step 16
- **먼저 쓸 실패 테스트**: 없음 (interface만)
- **최소 구현**: `src/layers/audio/audio-provider.ts`
  - `play(): Promise<void>`, `pause()`, `stop()`, `seek(seconds)`
  - `setBpm`, `setMasterVolume`, `setLoop`
  - `createTrack(trackId)`, `removeTrack(trackId)`, `setTrackVolume`, `setTrackMute`, `setTrackSolo`, `setTrackPan`
  - `addRegion({ trackId, regionId, assetId, startTime, duration, offset })`
  - `removeRegion(trackId, regionId)`, `moveRegion(trackId, regionId, startTime)`, `resizeRegion(trackId, regionId, duration)`
  - `getAssetDuration(assetId): Promise<number>`
  - `syncSession(session): Promise<void>`
- **참조**: 원본 `src/layers/audio-engine/i-audio-engine.ts`. 단, `loadFile(File)` → `getAssetDuration(assetId)`로 추상화. `getDebugInfo`/`getCurrentTime`은 제거 (또는 별도)
- **완료 조건**: `pnpm typecheck` 통과
- **커밋 메시지**: `feat(audio): define audio provider interface`
- **소요**: M

### Step 18. `FakeAudioProvider`를 구현한다

- **목표**: 모든 호출을 `CallRecorder`에 기록, `getAssetDuration`은 주입된 map에서 반환
- **선행 조건**: Step 17
- **먼저 쓸 실패 테스트**: `src/layers/audio/fake-audio-provider.test.ts`
  - `records play/pause/stop calls in order`
  - `returns configured asset duration`
  - `defaults asset duration to 1 second when not configured`
  - `syncSession records track and region creation in deterministic order`
- **최소 구현**: `src/layers/audio/fake-audio-provider.ts`. 생성자에 `{ callRecorder?, assetDurations? }`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(audio): implement fake audio provider`
- **소요**: M

### Step 19. controller→audio boundary 테스트를 강화한다

- **목표**: controller가 `AudioProvider` interface만 사용. 구체 클래스 import 금지
- **선행 조건**: Step 18
- **먼저 쓸 실패 테스트**: `architecture-boundary.test.ts`에 추가
  - `controllers do not import FakeAudioProvider`
  - `controllers do not import from layers/audio/tone`
- **최소 구현**: 케이스 추가
- **완료 조건**: 통과
- **커밋 메시지**: `test(architecture): forbid concrete audio provider import in controllers`
- **소요**: S

> **체크포인트 (Phase E 끝)**: `pnpm test && pnpm typecheck` 통과

---

## Phase F — Domain Controllers

### Step 20. session store wrapper를 만든다 (Zustand vanilla)

- **목표**: controller가 사용할 `SessionStore`. action을 store에 두지 않고 외부 operation 함수를 apply
- **선행 조건**: Step 19
- **먼저 쓸 실패 테스트**: `src/layers/core/session/session-store.test.ts`
  - `starts with empty session`
  - `applyOperation replaces state immutably`
  - `notifies subscribers on change`
  - `getState returns the latest snapshot reference`
- **최소 구현**: `src/layers/core/session/session-store.ts`. `createSessionStore({ createEmptySession })`. `applyOperation((state) => nextState)` 메서드 노출
- **참조**: 원본 `createSessionStore` 패턴은 차용하되, action 함수는 store 자체가 아니라 core operation 모듈에
- **완료 조건**: 통과
- **커밋 메시지**: `feat(core): add session store backed by zustand vanilla`
- **소요**: M

### Step 21. `TrackController`를 구현한다

- **목표**: 기존 `command-controller.ts`의 `TrackCommandTarget` interface를 만족
- **선행 조건**: Step 20
- **먼저 쓸 실패 테스트**: `src/layers/controllers/track-controller.test.ts`
  - `addTrack returns { id: generatedId } and calls audio.createTrack(id)`
  - `removeTrack calls audio.removeTrack and updates session`
  - `setTrackVolume / Mute / Solo / Pan dispatch to session + audio`
  - `addRegionFromAsset queries duration via audio.getAssetDuration, updates session, then calls audio.addRegion in that order`
  - `moveRegion / resizeRegion / removeRegion update both sides`
  - `splitRegion returns { leftId, rightId }; only the right region is created in audio; left is resized in audio`
  - `propagates core domain errors (TrackNotFoundError, RegionNotFoundError) by throwing`
- **최소 구현**: `src/layers/controllers/track-controller.ts`. 의존성: `sessionStore`, `audioProvider`, `idGenerator`
- **참조**: 원본 `track-controller.ts`의 도메인 로직. `crypto.randomUUID` 직접 호출은 금지 → `idGenerator.next('track' | 'region')`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(controllers): implement track controller`
- **소요**: L

### Step 22. `PlaybackController`를 구현한다

- **목표**: `PlaybackCommandTarget` 구현
- **선행 조건**: Step 21
- **먼저 쓸 실패 테스트**: `src/layers/controllers/playback-controller.test.ts`
  - `handlePlay calls audio.play and sets playback.playing = true`
  - `handlePause calls audio.pause and clears playing`
  - `handleStop calls audio.stop, sets playing false and position 0`
  - `handleSeek updates session position and audio position`
  - `handleLoop updates both`
  - `handleBpm updates both`
  - `handleMasterVolume updates both`
- **최소 구현**: `src/layers/controllers/playback-controller.ts`
- **참조**: 원본 `playback-controller.ts`. 단, session mutation은 core operation으로
- **완료 조건**: 통과
- **커밋 메시지**: `feat(controllers): implement playback controller`
- **소요**: M

### Step 23. `SessionPersistenceController`를 구현한다

- **목표**: save / restore / export
- **선행 조건**: Step 22
- **먼저 쓸 실패 테스트**: `src/layers/controllers/session-persistence-controller.test.ts`
  - `saveSession writes current snapshot to storage`
  - `saveSession clears dirty after success`
  - `saveSession keeps dirty on storage failure and rethrows wrapped error`
  - `restoreSession loads snapshot, replaces session, then calls audio.syncSession`
  - `restoreSession is a no-op when storage is empty`
  - `exportSession returns NotImplementedYet for MVP`
- **최소 구현**: `src/layers/controllers/session-persistence-controller.ts`. 의존성: `sessionStore`, `storage`, `audioProvider`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(controllers): implement session persistence controller`
- **소요**: M

### Step 24. `AutosaveController`를 구현한다

- **목표**: session.dirty=true이면 debounce해서 save 트리거
- **선행 조건**: Step 23
- **먼저 쓸 실패 테스트**: `src/layers/controllers/autosave-controller.test.ts` (`vi.useFakeTimers()` 사용)
  - `schedules save when session becomes dirty`
  - `debounces repeated changes inside the window`
  - `does not save a clean session`
  - `stops scheduling after dispose()`
- **최소 구현**: `src/layers/controllers/autosave-controller.ts`. 의존성: `sessionStore`, `persistenceController`, `{ debounceMs, timer }`. timer 주입 (setTimeout/clearTimeout)
- **완료 조건**: 통과
- **커밋 메시지**: `feat(controllers): add autosave controller`
- **소요**: M

### Step 25. command target interface와 controller 시그니처를 정렬한다

- **목표**: `addTrack`, `addRegionFromAsset`, `splitRegion`의 반환 shape를 command result data와 일치
- **선행 조건**: Step 24
- **먼저 쓸 실패 테스트**: `track-controller.test.ts`에 추가
  - `addTrack returns { id }`
  - `addRegionFromAsset returns { id }`
  - `splitRegion returns { leftId, rightId }`
- **최소 구현**: 시그니처 정리
- **완료 조건**: 통과
- **커밋 메시지**: `refactor(controllers): align controller return shapes with command targets`
- **소요**: S

### Step 26. command-controller integration 테스트를 추가한다

- **목표**: 실제 controller가 wired되었을 때 기존 command-controller.test.ts의 약속이 유지되는지
- **선행 조건**: Step 25
- **먼저 쓸 실패 테스트**: `src/layers/controllers/command-controller.integration.test.ts`
  - 실제 `TrackController` + `PlaybackController` + `SessionPersistenceController` + `MemorySessionStorage` + `FakeAudioProvider` + 결정적 id-generator로 wiring
  - `track.add → result.data === { id: 'track-1' }`
  - `region.split → result.data === { leftId, rightId }`
  - `track.volume.set returns ok with no data`
- **최소 구현**: 테스트만
- **완료 조건**: 통과
- **커밋 메시지**: `test(controllers): verify integration with real controllers`
- **소요**: M

### Step 27. dirty tracking을 command 경로에서 검증한다

- **목표**: track.add 후 dirty=true, session.save 후 false, playback.play는 dirty=false 유지
- **선행 조건**: Step 26
- **먼저 쓸 실패 테스트**: 같은 integration 파일에 추가
  - `track.add marks session dirty`
  - `session.save clears dirty`
  - `playback.play does not mark dirty`
- **최소 구현**: 필요 시 operation 보정 (Phase C에서 이미 맞춰뒀으면 검증만)
- **완료 조건**: 통과
- **커밋 메시지**: `test(controllers): verify dirty tracking through command path`
- **소요**: S

### Step 28. validation vs execution failure 경계를 못박는다

- **목표**: core domain error는 `COMMAND_EXECUTION_FAILED`, schema 위반은 `COMMAND_VALIDATION_FAILED`로 분류
- **선행 조건**: Step 27
- **먼저 쓸 실패 테스트**: 같은 integration 파일
  - `track.remove with unknown trackId returns COMMAND_EXECUTION_FAILED`
  - `track.volume.set with volume=2 returns COMMAND_VALIDATION_FAILED (controller not called)`
- **최소 구현**: 필요 없으면 0
- **완료 조건**: 통과
- **커밋 메시지**: `test(controllers): lock validation vs execution failure boundary`
- **소요**: S

> **체크포인트 (Phase F 끝)**: `pnpm test && pnpm typecheck` 통과. FakeAudioProvider + MemorySessionStorage만 가지고도 모든 command 경로가 실제로 동작한다.

---

## Phase G — Composition Root + in-memory e2e

### Step 29. `createApp` composition root를 만든다

- **목표**: 의존성 wiring을 한 곳에. apps는 이 함수만 부른다
- **선행 조건**: Step 28
- **먼저 쓸 실패 테스트**: `src/layers/apps/create-app.test.ts`
  - `creates an AppController wired with track, playback, persistence controllers`
  - `default factory uses MemorySessionStorage and FakeAudioProvider when none provided`
  - `accepts injected providers for browser composition`
- **최소 구현**: `src/layers/apps/create-app.ts`. 시그니처: `createApp({ audioProvider?, storage?, idGenerator?, now?, autosave? })`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(apps): add composition root`
- **소요**: M

### Step 30. CLI runner를 추가한다 (parser → executeCommand)

- **목표**: CLI 문자열을 받아 진짜 session에 변화를 일으킨다
- **선행 조건**: Step 29
- **먼저 쓸 실패 테스트**: `src/layers/apps/cli/cli-runner.test.ts`
  - `cli "track add" creates a track`
  - `cli "volume track-1 0.5" updates volume`
  - `cli "session save" persists snapshot to memory storage`
  - `cli "session restore" restores after store reset`
  - `cli invalid input does not call any controller method` (FakeAudioProvider recorder가 비어 있음으로 확인)
- **최소 구현**: `src/layers/apps/cli/cli-runner.ts`. `runCli(input, { appController })`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(cli): execute parsed commands through app controller`
- **소요**: M

### Step 31. in-memory end-to-end smoke 테스트

- **목표**: track 추가 → region 추가 → region split → save → 새 인스턴스에서 restore → 트랙 1개 region 2개 확인
- **선행 조건**: Step 30
- **먼저 쓸 실패 테스트**: `src/layers/apps/integration.in-memory.test.ts`
  - `simulates a full edit session and restores it`
- **최소 구현**: 통합 테스트만
- **완료 조건**: 통과
- **커밋 메시지**: `test(integration): cover full in-memory edit save restore`
- **소요**: M

> **체크포인트 (Phase G 끝)**: 첫 데모 가능 시점. UI 없이 CLI + 인메모리로 한 session의 생명주기가 동작한다. 자연스러운 휴식 지점.

---

## Phase H — Tone Audio Adapter

### Step 32. `ToneAudioProvider`의 transport 메서드를 만든다

- **목표**: play / pause / stop / seek / setBpm / setMasterVolume / setLoop
- **선행 조건**: Step 31
- **먼저 쓸 실패 테스트**: `src/layers/audio/tone/tone-audio-provider.test.ts` (Tone은 `vi.mock('tone', ...)`로 mock)
  - `play calls Tone.getTransport().start()`
  - `pause calls Tone.getTransport().pause()`
  - `seek sets Tone.getTransport().seconds`
  - `setBpm sets Tone.getTransport().bpm.value`
  - `setMasterVolume sets Tone.getDestination().volume.value (dB)`
  - `setLoop wires Transport.loopStart/loopEnd/loop`
- **최소 구현**: `src/layers/audio/tone/tone-audio-provider.ts` (transport만). `getAssetDuration`은 임시 `Promise.resolve(0)` 또는 throw
- **참조**: 원본 `audio-engine.ts`의 transport 부분
- **완료 조건**: 통과
- **커밋 메시지**: `feat(audio): add tone provider transport methods`
- **소요**: M

### Step 33. ToneAudioProvider에 Track/Region wiring을 추가한다

- **목표**: createTrack/removeTrack → Tone.Channel. addRegion → Tone.Player(...).sync().start. moveRegion / resizeRegion / removeRegion. getAssetDuration → 미리 등록된 ToneAudioBuffer
- **선행 조건**: Step 32
- **먼저 쓸 실패 테스트**: 같은 파일
  - `createTrack registers a Channel`
  - `addRegion connects a Player to the track channel and syncs to transport`
  - `moveRegion stops old playback and restarts at new time`
  - `removeRegion disposes the player`
  - `removeTrack disposes channel and all attached regions`
  - `getAssetDuration returns registered buffer duration`
- **참조**: 원본 `audio-engine.ts`의 createTrack/addRegion/moveRegion/removeRegion/removeTrack. 매핑 패턴 그대로
- **완료 조건**: 통과
- **커밋 메시지**: `feat(audio): add tone provider track and region wiring`
- **소요**: L

### Step 34. ToneAudioProvider에 `syncSession`을 추가한다

- **목표**: restore 후 session snapshot을 받아 audio graph 전체를 재구성
- **선행 조건**: Step 33
- **먼저 쓸 실패 테스트**: 같은 파일
  - `syncSession recreates channels and players from a snapshot`
  - `syncSession is idempotent on identical snapshot`
- **최소 구현**: `syncSession`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(audio): add session sync to tone provider`
- **소요**: M

> **체크포인트 (Phase H 끝)**: controller 테스트는 Fake로, Tone 테스트는 mock으로 모두 jsdom에서 빠르게 통과

---

## Phase I — IndexedDB + Autosave 활성화

### Step 35. `fake-indexeddb`를 devDependency로 추가한다

- **목표**: IndexedDB 테스트를 deterministic하게
- **선행 조건**: Step 34
- **먼저 쓸 실패 테스트**: 없음 (의존성만)
- **최소 구현**: `package.json`에 `"fake-indexeddb": "^6"` 추가. 별도 setupFiles 없이 storage 테스트 파일에서만 `import 'fake-indexeddb/auto'`
- **완료 조건**: `pnpm install` 통과
- **커밋 메시지**: `chore(test): add fake-indexeddb for storage tests`
- **소요**: S

### Step 36. `IndexedDbSessionStorage` adapter를 구현한다

- **목표**: SessionStorageProvider 계약을 IndexedDB로 충족
- **선행 조건**: Step 35
- **먼저 쓸 실패 테스트**: `src/layers/storage/indexeddb/indexed-db-session-storage.test.ts` (맨 위에 `import 'fake-indexeddb/auto'`)
  - Step 16의 `runSessionStorageContract` 호출
  - `survives across new adapter instances on the same db name`
  - `clear empties the persisted store`
- **최소 구현**: `src/layers/storage/indexeddb/indexed-db-session-storage.ts`. db name/store name 고정. `loadLatest`는 가장 최근 `updatedAt`, `save`는 put, `clear`는 objectStore.clear
- **완료 조건**: 통과
- **커밋 메시지**: `feat(storage): implement indexeddb session storage`
- **소요**: L

### Step 37. createApp이 환경에 따라 기본 storage를 선택하게 한다

- **목표**: indexedDB가 있으면 IndexedDb, 없으면 Memory
- **선행 조건**: Step 36
- **먼저 쓸 실패 테스트**: `create-app.test.ts`에 추가
  - `uses memory storage when indexedDB is undefined`
  - `uses indexedDb storage when indexedDB is available (with fake-indexeddb auto-load)`
- **최소 구현**: `createApp` 안에 `typeof indexedDB !== 'undefined'` 분기
- **완료 조건**: 통과
- **커밋 메시지**: `feat(apps): wire indexeddb storage as default when available`
- **소요**: S

### Step 38. AutosaveController를 createApp에 연결한다

- **목표**: `createApp({ autosave: true })` 옵션
- **선행 조건**: Step 37
- **먼저 쓸 실패 테스트**: `src/layers/apps/integration.autosave.test.ts` (`vi.useFakeTimers()`)
  - `executing track.add triggers autosave after debounce`
  - `repeated mutations debounce to a single save`
  - `autosave can be disposed`
- **최소 구현**: createApp 옵션 + dispose 핸들 반환
- **완료 조건**: 통과
- **커밋 메시지**: `feat(apps): wire autosave into composition root`
- **소요**: M

### Step 39. UI 없이 reload recovery integration 테스트

- **목표**: 첫 app dispose → 새 app이 같은 db에서 session.restore
- **선행 조건**: Step 38
- **먼저 쓸 실패 테스트**: `src/layers/apps/integration.recovery.test.ts` (`import 'fake-indexeddb/auto'`)
  - createApp() → track.add + region.add → autosave 트리거 (fake timer advance)
  - 첫 app dispose
  - createApp() 새로 호출 (같은 db) → `executeCommand({ type: 'session.restore' })` → 트랙/region 복원
- **최소 구현**: 테스트만
- **완료 조건**: 통과
- **커밋 메시지**: `test(integration): cover reload recovery via indexeddb`
- **소요**: M

> **체크포인트 (Phase I 끝)**: UI 없이 reload recovery가 데이터 레이어에서 검증됨. v3의 핵심 약속이 잠긴다.

---

## Phase J — Web UI Adapter (React)

### Step 40. React/React-DOM/Testing-Library를 추가하고 jsx env 확인

- **목표**: jsdom에서 React 컴포넌트 렌더 가능 확인
- **선행 조건**: Step 39
- **먼저 쓸 실패 테스트**: `src/layers/apps/web/__bootstrap__/jsx-env.test.tsx`
  - `renders a hello span`
- **최소 구현**: `package.json`에 `react`, `react-dom`, `@testing-library/react`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom` 추가. `tsconfig.app.json`에 `"jsx": "react-jsx"`
- **완료 조건**: 통과
- **커밋 메시지**: `chore(web): add react and testing-library`
- **소요**: M

### Step 41. `useSessionSnapshot` read-only hook

- **목표**: React 컴포넌트가 session을 읽기 전용으로 구독
- **선행 조건**: Step 40
- **먼저 쓸 실패 테스트**: `src/layers/apps/web/hooks/use-session-snapshot.test.tsx`
  - `returns current session snapshot`
  - `re-renders when session changes (via controller)`
  - `does not expose any setter`
- **최소 구현**: Zustand vanilla `subscribe` + `useSyncExternalStore`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(web): add read-only session snapshot hook`
- **소요**: M

### Step 42. `AppControllerProvider` Context와 `useAppController` 훅

- **목표**: prop drilling 없이 컴포넌트가 `appController` 사용
- **선행 조건**: Step 41
- **먼저 쓸 실패 테스트**: `src/layers/apps/web/context/app-controller-context.test.tsx`
  - `provides controller to consumers`
  - `throws when used outside provider`
- **최소 구현**: Context + 훅
- **완료 조건**: 통과
- **커밋 메시지**: `feat(web): add app controller context`
- **소요**: S

### Step 43. Transport UI 컴포넌트

- **목표**: play/pause/stop/seek/bpm/master volume/loop. 모든 호출은 executeCommand
- **선행 조건**: Step 42
- **먼저 쓸 실패 테스트**: `src/layers/apps/web/ui/transport/transport.test.tsx`
  - `clicking play executes playback.play`
  - `clicking pause executes playback.pause`
  - `entering bpm executes playback.bpm.set with parsed number`
  - `entering non-number bpm does not call executeCommand`
  - `master volume slider executes playback.masterVolume.set`
  - `error result is rendered as inline error`
- **참조**: 원본 transport UI 구조 참고. 호출만 command로
- **완료 조건**: 통과
- **커밋 메시지**: `feat(web): add transport UI`
- **소요**: M

### Step 44. Track List UI 컴포넌트

- **목표**: add/remove/volume/mute/solo/pan을 모두 command로
- **선행 조건**: Step 43
- **먼저 쓸 실패 테스트**: `src/layers/apps/web/ui/track-list/track-list.test.tsx`
  - `clicking add track executes track.add`
  - `volume slider executes track.volume.set`
  - `mute / solo toggle executes track.mute.set / track.solo.set`
  - `pan slider executes track.pan.set`
  - `remove button executes track.remove`
  - `renders trackOrder order` (normalized 구조 사용)
- **참조**: 원본 track-list UI 구조 참고
- **완료 조건**: 통과
- **커밋 메시지**: `feat(web): add track list UI`
- **소요**: L

### Step 45. Region UI + Session toolbar + Web App shell

- **목표**: region add/move/split/resize/remove + session save/restore
- **선행 조건**: Step 44
- **먼저 쓸 실패 테스트**: `src/layers/apps/web/web-app.test.tsx`
  - `renders transport, tracks, session toolbar`
  - `clicking save executes session.save`
  - `clicking restore executes session.restore`
  - `dragging region executes region.move (mocked drag handler)`
  - `clicking split with selected region executes region.split`
- **최소 구현**: `src/layers/apps/web/web-app.tsx` + region subcomponents
- **완료 조건**: 통과
- **커밋 메시지**: `feat(web): wire region and session toolbar`
- **소요**: L

> **체크포인트 (Phase J 끝)**: UI에서 발생하는 모든 mutation이 command path로 흐름이 테스트로 잠긴다

---

## Phase K — Keyboard Adapter

### Step 46. `KeyboardCommandAdapter` 매핑 함수

- **목표**: 키 이벤트 → AppCommand 매핑 (data-driven)
- **선행 조건**: Step 45
- **먼저 쓸 실패 테스트**: `src/layers/apps/keyboard/keyboard-adapter.test.ts`
  - `space maps to playback.play when paused`
  - `space maps to playback.pause when playing`
  - `cmd+s maps to session.save`
  - `shift+t maps to track.add`
  - `unknown key returns null`
- **최소 구현**: pure 함수 `keyEventToCommand(event, sessionSnapshot)`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(keyboard): add keyboard to command adapter`
- **소요**: M

### Step 47. KeyboardAdapter를 web shell에 마운트

- **목표**: 실제 키 입력이 executeCommand 호출
- **선행 조건**: Step 46
- **먼저 쓸 실패 테스트**: `web-app.test.tsx`에 추가
  - `pressing space executes playback.play`
- **최소 구현**: `web-app.tsx`의 useEffect에 keydown listener
- **완료 조건**: 통과
- **커밋 메시지**: `feat(web): mount keyboard shortcuts`
- **소요**: S

---

## Phase L — Agent Adapter (rule-based first)

### Step 48. agent intent → command fixture를 정의한다

- **목표**: 5–10개 한국어 자연어를 command로 매핑하는 fixture
- **선행 조건**: Step 47
- **먼저 쓸 실패 테스트**: `src/layers/apps/agent/intent-fixtures.test.ts`
  - `'트랙 하나 추가해줘' → { type: 'track.add' }`
  - `'track-1 볼륨 0.5로' → { type: 'track.volume.set', payload: { trackId: 'track-1', volume: 0.5 } }`
  - `'처음부터 재생' → { type: 'playback.seek', payload: { seconds: 0 } }`
  - `'저장해줘' → { type: 'session.save' }`
- **최소 구현**: `src/layers/apps/agent/intent-fixtures.ts` (data only)
- **완료 조건**: 통과
- **커밋 메시지**: `test(agent): lock natural-language intent fixtures`
- **소요**: S

### Step 49. `AgentCommandAdapter` (rule-based)

- **목표**: fixture를 통과시키는 최소 rule-based parser. 외부 의존성 0
- **선행 조건**: Step 48
- **먼저 쓸 실패 테스트**: `src/layers/apps/agent/agent-adapter.test.ts`
  - fixture 전체 통과
  - `ambiguous request returns { ok: false, reason: 'NEEDS_CLARIFICATION' }`
- **최소 구현**: `src/layers/apps/agent/agent-adapter.ts`. `proposeCommand(input): Proposal`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(agent): add rule-based agent command adapter`
- **소요**: M

### Step 50. agent proposal을 AppController로 실행

- **목표**: 자연어 한 줄이 진짜 session에 반영
- **선행 조건**: Step 49
- **먼저 쓸 실패 테스트**: `src/layers/apps/agent/agent-runner.test.ts`
  - `runs '트랙 하나 추가해줘' through the full app`
  - `does not execute when proposal is ambiguous`
  - `schema validation failure bubbles up`
- **최소 구현**: `src/layers/apps/agent/agent-runner.ts`
- **완료 조건**: 통과
- **커밋 메시지**: `feat(agent): execute proposals through app controller`
- **소요**: M

---

## Phase M — Input Equivalence & E2E Recovery

### Step 51. 5개 입력 경로 동등성 테스트

- **목표**: web, keyboard, cli, agent, harness가 모두 같은 session 변화를 만든다
- **선행 조건**: Step 50
- **먼저 쓸 실패 테스트**: `src/layers/apps/integration.input-equivalence.test.ts`
  - `web button add track produces { type: 'track.add' }`
  - `keyboard shift+t produces { type: 'track.add' }`
  - `cli 'track add' produces { type: 'track.add' }`
  - `agent '트랙 하나 추가해줘' produces { type: 'track.add' }`
  - `test harness executes { type: 'track.add' } directly`
  - 5개 경로 후 session.trackOrder.length === 1
- **최소 구현**: 테스트만
- **완료 조건**: 통과
- **커밋 메시지**: `test(integration): prove input command equivalence`
- **소요**: M

### Step 52. UI + IndexedDB 종합 recovery 테스트

- **목표**: 진짜 사용자 흐름 (jsdom + fake-indexeddb)
- **선행 조건**: Step 51
- **먼저 쓸 실패 테스트**: `src/layers/apps/integration.editor-recovery.test.tsx`
  - render `<WebApp />`
  - 클릭으로 트랙 + region 추가
  - fake timer로 autosave 트리거
  - 컴포넌트 unmount + 새 mount (새 createApp)
  - `session.restore` 트리거 (또는 mount 시 옵션)
  - 화면에 트랙/region 복원
- **최소 구현**: 테스트만 (필요 시 `restore on mount` 옵션)
- **완료 조건**: 통과
- **커밋 메시지**: `test(e2e): cover editor reload recovery`
- **소요**: L

### Step 53. Definition of Done 최종 검증

- **목표**: 7개 완료 기준 점검
- **선행 조건**: Step 52
- **먼저 쓸 실패 테스트**: 없음
- **최소 구현**: `pnpm test && pnpm typecheck` 풀 실행. 7항목 손으로 체크
- **완료 조건**: 모든 항목 yes
- **커밋 메시지**: `docs(rebuild): mark step-by-step plan complete`
- **소요**: S

> **체크포인트 (Phase M 끝, rebuild 완료)**: 자연어 한 문장, 키보드 한 번, CLI 한 줄, UI 클릭 한 번, 테스트 한 줄이 같은 session 변화를 만든다.

---

## 참조 표 — 원본 drop-ai → v3 step

| 원본 파일 (`/Users/whizzkid/Documents/HURREAY/code/drop-ai/...`) | v3 step | 변형 정도 |
|---|---|---|
| `src/layers/session/session.ts` (타입) | Step 6, 7, 10 | **재정의**. Map → `trackOrder + tracksById`. `src` → `assetId`. `isMuted/isSoloed` → `muted/soloed`. playback은 별도 |
| `src/layers/session/session.ts` (Zustand vanilla 패턴) | Step 20 | **패턴만 차용**. action은 store 외부 operation 함수로 분리 |
| `src/layers/audio-engine/i-audio-engine.ts` | Step 17 | **거의 그대로**. loadFile → getAssetDuration. debug 메서드 제거. syncSession 추가 |
| `src/layers/audio-engine/audio-engine.ts` (Tone 매핑) | Step 32–34 | **구현 이식**. 위치는 `audio/tone/`, 이름은 `ToneAudioProvider` |
| `src/layers/audio-engine/audio-engine.ts` (exportSession Offline) | (deferred) | MVP에서는 미구현 |
| `src/layers/controllers/playback-controller.ts` | Step 22 | **의도 그대로**. session mutation은 core operation 경유 |
| `src/layers/controllers/track-controller.ts` | Step 21 | **로직 그대로**. id는 idGenerator 주입. 직접 store action 호출 금지 |
| `src/layers/controllers/track-controller.ts` (splitRegion 계산) | Step 12 | **계산식 그대로**. 위치는 core operation. id는 외부 주입 |
| `src/layers/apps/create-app.ts` | Step 29 | **패턴 차용**. 의존성 더 많이 받음 |
| `src/layers/apps/cli/index.ts` | Step 30 | **참고만**. v3는 parser/runner 분리 |
| `src/layers/apps/web/ui/components/transport/transport.tsx` | Step 43 | **시각 참고**. 호출은 executeCommand |
| `src/layers/apps/web/ui/components/track-list/track-list.tsx` | Step 44 | **시각 참고**. 호출은 executeCommand |

---

## 위험 / 사람이 자주 빠지는 함정

1. **core test에서 jsdom 의존이 새지 않게 한다.** `core/session/*.test.ts`는 `document`/`window`를 참조하지 않아야 한다. 의심되면 해당 폴더만 `environment: 'node'`로 따로 돌려본다.
2. **새 폴더가 추가되면 boundary test의 allow-list를 함께 업데이트한다.** 매번 confirm.
3. **`crypto.randomUUID()`는 controller에 직접 쓰지 않는다.** 항상 `idGenerator.next(...)` 주입. deterministic id가 없으면 split/region 테스트가 flaky.
4. **`session.dirty`는 편집에만 표시한다.** playback.play/pause/seek/stop은 dirty=false 유지. 사용자가 재생만 했는데 IndexedDB 쓰기가 일어나면 안 됨.
5. **`splitRegion`의 경계 조건은 strict 부등호.** 정확히 시작/끝 지점에서의 split은 reject.
6. **command schema에 새 command를 추가하면 4곳 동시 수정**: schema union, command-controller switch, 해당 `*CommandTarget` interface, controller 구현체. typecheck가 잡지만 의식적으로 패턴화.
7. **autosave 테스트는 항상 `vi.useFakeTimers()` 사용**. 끝나면 `vi.useRealTimers()`로 복원.
8. **`fake-indexeddb`는 jsdom의 `indexedDB`를 덮어쓴다.** import 한 줄로 자동 설정. 별도 setup file은 만들지 않고, 필요한 테스트에서만 import.
9. **agent adapter는 rule-based로 출발.** LLM 교체 시에도 `proposeCommand(input): Proposal` 인터페이스를 유지.
10. **`apps/`에서 sessionStore를 직접 import하지 않는다.** boundary test에 케이스 추가 가능.
11. **normalized 구조에서 reorder는 order array만 바꾼다.** `tracksById`의 reference는 그대로 → 리렌더 최적화에 유리.

---

## 최종 정의 (Definition of Done)

rebuild 완료 기준 7가지 (기존 rebuild-execution-plan.md 유지):

1. UI, keyboard, CLI, AI Agent, test harness가 모두 `AppController.executeCommand`를 사용한다 — Step 51로 잠금
2. Zod command schema가 invalid payload를 실행 전에 막는다 — Step 28로 잠금
3. core/controller 테스트가 Tone.js와 browser API 없이 실행된다 — Phase C 전체가 node-friendly, Tone은 Step 32–34에서만 (mock)
4. Tone.js는 AudioProvider adapter 내부에만 있다 — Step 3 boundary로 잠금
5. IndexedDB session storage가 autosave와 restore를 지원한다 — Step 36, 38, 39
6. dirty tracking이 저장 전후 상태를 정확히 표현한다 — Step 13, 23, 27
7. 새로고침 이후 편집 session이 복구된다 — Step 39 (data) + Step 52 (UI+data)

---

## 검증 (rebuild 완료 시점)

```
pnpm install
pnpm test         # 전체 unit + integration 통과
pnpm typecheck    # 전부 통과
```

위 둘이 녹색이고, 7개 DoD 항목이 모두 yes이면 rebuild 완료.

---

## 작업 한 회기 권장 종료 지점

순서대로 진행했을 때 자연스러운 휴식 지점:

- **회기 1 (오전)**: Step 1–13 (Phase A–C) — core operation까지
- **회기 2 (오후)**: Step 14–28 (Phase D–F) — controller 통합까지
- **회기 3 (다음날 오전)**: Step 29–31 (Phase G) — **첫 데모 가능 시점, CLI로 동작**
- **회기 4 (다음날 오후)**: Step 32–34 (Phase H) — Tone adapter
- **회기 5**: Step 35–39 (Phase I) — IndexedDB recovery까지, **UI 없이 핵심 약속 완성**
- **회기 6–7**: Step 40–45 (Phase J) — Web UI
- **회기 8**: Step 46–53 (Phase K–M) — Keyboard, Agent, 종합

소요는 사람마다 다르므로 estimate은 가이드일 뿐. 각 step의 S/M/L 표시를 회기 계획에 참고.

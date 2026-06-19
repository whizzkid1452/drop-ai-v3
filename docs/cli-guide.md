# drop-ai-v3 터미널 가이드

drop-ai-v3 는 현재 헤드리스 (브라우저 UI 없음) 상태이며, 터미널에서 모든 도메인 동작을 시도하고 검증할 수 있다.

이 문서는 두 가지를 다룬다.

1. **REPL** — `pnpm repl` 로 띄워서 한 줄씩 명령을 입력하며 세션을 조작
2. **개발/검증 명령** — test, typecheck, lint 등의 개발 작업

---

## 1. REPL (대화형 세션 조작)

### 시작

```bash
pnpm repl
```

띄우면 다음과 같이 보인다.

```
drop-ai-v3 REPL
Type "help" for commands, "exit" to quit.
Note: no real audio playback (no browser AudioContext).
>
```

`>` 프롬프트에 명령을 한 줄씩 입력한다.

### 명령 목록

#### Transport (재생 제어)

| 명령 | 동작 |
|---|---|
| `play` | 재생 시작 (`playback.play` command) |
| `pause` | 일시정지 |
| `stop` | 정지 + 위치 0 으로 |
| `seek <seconds>` | 특정 시간으로 이동. 예: `seek 5` |
| `loop <start> <end> <on\|off>` | 루프 구간 설정. 예: `loop 0 4 on` |
| `bpm <number>` | BPM 변경. 예: `bpm 140` |
| `master <0..1>` | 마스터 볼륨. 예: `master 0.7` |

#### Track (트랙)

| 명령 | 동작 |
|---|---|
| `track add` | 새 트랙 추가. 자동으로 `track-1`, `track-2`… 식의 ID 부여 |
| `track remove <trackId>` | 트랙과 모든 region 제거 |
| `volume <trackId> <0..1>` | 트랙 볼륨 |
| `mute <trackId> <on\|off>` | 음소거 |
| `solo <trackId> <on\|off>` | 솔로 |
| `pan <trackId> <-1..1>` | 좌/우 패닝 |

#### Region (구간)

| 명령 | 동작 |
|---|---|
| `region add <trackId> <assetId> <startTime>` | 트랙에 region 추가. 예: `region add track-1 asset-1 0` |
| `region move <trackId> <regionId> <startTime>` | region 시작 시간 변경 |
| `region split <trackId> <regionId> <splitTime>` | region 을 한 시점에서 둘로 분리. 왼쪽은 원래 id 유지, 오른쪽은 새 id |
| `region resize <trackId> <regionId> <duration>` | 길이 변경 |
| `region remove <trackId> <regionId>` | region 제거 |

#### Session (세션 영속화)

| 명령 | 동작 |
|---|---|
| `session save` | 현재 세션을 storage 에 저장. dirty=false 로 변경 |
| `session restore` | storage 에서 최신 세션 복원 + audio graph 재구성 |
| `session export` | 세션을 WAV 로 export. REPL 에서는 FakeAudio 라 0 byte (실제 byte 는 브라우저 필요) |

#### Special (REPL 전용 메타 명령)

| 명령 | 동작 |
|---|---|
| `state` | 현재 세션 snapshot 전체를 JSON 으로 출력 |
| `tracks` | 트랙 요약 한 줄씩 출력 (volume/mute/solo/pan + region 목록) |
| `help` | 명령 목록 |
| `exit` 또는 `quit` | REPL 종료 |
| 빈 입력 | 무시 |

### 결과 표시 형식

```
OK <JSON 데이터>          # 성공. 데이터 있으면 JSON 으로
OK                        # 성공, 데이터 없음
OK exported "<filename>" (<n> bytes)   # session export 의 특수 출력
ERR <ERROR_CODE> - <메시지>             # 실패
```

에러 코드:

- `COMMAND_VALIDATION_FAILED` — Zod 스키마 검증 실패 (범위 초과, 필드 누락, 모르는 명령 등)
- `COMMAND_EXECUTION_FAILED` — 도메인 에러 (존재하지 않는 track/region 등)

### 시나리오 예시

**기본 흐름 — 트랙 추가/믹서 조정/요약 출력**

```
> track add
OK {"id":"track-1"}
> track add
OK {"id":"track-2"}
> volume track-1 0.5
OK
> mute track-2 on
OK
> tracks
track-1  vol=0.5 mute=false solo=false pan=0  no regions
track-2  vol=1 mute=true solo=false pan=0  no regions
```

**Region 추가 + split**

```
> track add
OK {"id":"track-1"}
> region add track-1 asset-1 0
OK {"id":"region-1"}
> region split track-1 region-1 0.5
OK {"leftId":"region-1","rightId":"region-2"}
> tracks
track-1  vol=1 mute=false solo=false pan=0  region-1[0s,+0.5s], region-2[0.5s,+0.5s]
```

region 의 duration 은 FakeAudio 의 default 1 초 (assetDurations 에 미리 등록된 값이 없을 때).

**저장 → 새 인스턴스에서 복원 (Node 환경에서는 REPL 한 세션 안에서만)**

```
> track add
OK {"id":"track-1"}
> session save
OK
> state
... "dirty": false ...
```

REPL 은 MemoryStorage 를 쓰므로 REPL 종료 시 사라진다. 실제 reload recovery 는 fake-indexeddb 를 import 한 테스트에서만 검증된다.

**에러 케이스**

```
> volume track-1 2
ERR COMMAND_VALIDATION_FAILED - Command payload is invalid.
> volume missing 0.5
ERR COMMAND_EXECUTION_FAILED - Track not found: missing
> bpm 0
ERR COMMAND_VALIDATION_FAILED - Command payload is invalid.
> foobar
ERR COMMAND_VALIDATION_FAILED - Unknown command: foobar.
```

전자는 schema 위반 (실행 전 차단), 후자는 도메인 위반 (controller 가 throw).

### 한계

- **실제 소리는 나지 않음.** Node 에 Web Audio API 가 없어서 ToneAudioProvider 대신 FakeAudioProvider 가 주입된다. `play` 는 호출 기록만 남기고 소리는 안 난다.
- **새로고침 복구 안 됨.** Node 에 indexedDB 가 없어서 MemoryStorage 가 default. REPL 을 끄면 세션이 휘발한다. 진짜 복구 흐름은 브라우저 (Phase J) 또는 fake-indexeddb 테스트로 검증한다.
- **`session export` 의 byte 가 0.** FakeAudio 가 빈 Blob 을 반환한다. 진짜 WAV 는 브라우저에서 ToneAudioProvider 가 Tone.Offline 으로 렌더할 때 나온다.

---

## 2. 개발 / 검증 명령

### 매 변경마다 돌리는 4 가지

```bash
pnpm test         # 236 tests (전체)
pnpm typecheck    # tsc -b
pnpm lint         # ESLint 9 flat config
grep ' as ' src/ scripts/ --include='*.ts' --include='*.tsx' -rn   # 새 as 캐스트 검사
```

세 명령 모두 그린이어야 다음 단계로 넘어간다. 새 `as` 가 추가되면 unknown + type guard, namespace object, named import 중 하나로 즉시 대체한다.

### 테스트 부분 실행

```bash
pnpm test src/layers/core/                            # 특정 폴더
pnpm test src/layers/apps/cli/cli-runner.test.ts      # 특정 파일
pnpm test -t "track add"                              # 특정 케이스 (제목 매칭)
```

### Watch 모드

```bash
pnpm test:watch
```

파일 변경 감지하면서 영향받는 테스트만 재실행.

### Lint 자동 수정

```bash
pnpm lint:fix
```

---

## 3. 아직 안 되는 명령

다음은 의도적으로 정의되지 않음.

| 명령 | 안 되는 이유 |
|---|---|
| `pnpm dev` | `index.html`, `src/main.tsx`, `vite.config.ts` 없음. Web UI 진입점이 없음 (Phase J 에서 추가) |
| `pnpm build` | 동일. vite 가 entry 를 찾지 못함 |
| 진짜 오디오 재생 | Node 환경엔 Web Audio API 가 없음. 브라우저 entry 가 만들어진 후 가능 |

Phase J (Web UI Adapter) 완료 시 위 셋 모두 자연스럽게 해결된다.

---

## 4. REPL 안의 특수 구현 디테일

- **deterministic ID**: REPL 은 `track-1`, `track-2`, `region-1`… 식의 순차 ID 를 만든다. production 의 `createUuidGenerator` 대신 counter-based generator 를 주입한다. UI 친화적.
- **autosave 활성화**: `createApp({ autosave: { debounceMs: 500 } })`. 트랙/region 편집 0.5 초 후 storage 에 자동 저장. REPL 의 MemoryStorage 라 휘발성이지만 흐름은 작동.
- **AudioProvider** = FakeAudioProvider. 모든 audio 호출은 `CallRecorder` 에 기록만 됨.
- **Storage** = MemoryStorage. Node 에 indexedDB 없음을 `isIndexedDbAvailable()` 가 감지해서 fallback.

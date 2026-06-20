# Drop AI v3 인앱 CLI 가이드

Drop AI v3의 CLI는 현재 별도 Node REPL이 아니라 Web 앱 안에 표시되는 xterm 기반 인앱 CLI다.

현재 실행 흐름은 다음과 같다.

```sh
pnpm install
pnpm dev
```

Vite가 출력한 로컬 주소를 열고, 오디오 파일을 업로드하면 workspace 화면과 CLI가 표시된다.

## CLI의 역할

CLI는 session을 직접 수정하지 않는다.

입력 문자열은 `src/apps/cli/command-registry.ts`와 `src/apps/cli/cli-parser.ts`를 거쳐 `AppCommand`로 변환된다. 변환된 command는 Web UI와 같은 `AppController.executeCommand()` 경계를 통과한다.

```txt
CLI input
  -> parseCliInput
  -> AppCommand
  -> AppController.executeCommand
  -> CommandController
  -> Domain Controller
  -> SessionStore / IAudioEngine
```

`help`, `commands`, `status`는 session을 변경하지 않는 local command다.

## Local Commands

| 명령       | 동작                                    |
| ---------- | --------------------------------------- |
| `help`     | 업로드 정보와 기본 사용 흐름을 출력한다 |
| `commands` | 사용 가능한 command 목록을 출력한다     |
| `status`   | 현재 session 요약을 출력한다            |

## Playback

| 명령                 | 동작                          |
| -------------------- | ----------------------------- |
| `play`               | 재생 시작                     |
| `pause`              | 일시정지                      |
| `stop`               | 정지 후 playhead를 0으로 이동 |
| `seek <seconds>`     | playhead를 특정 초로 이동     |
| `loop off`           | loop 비활성화                 |
| `loop <start> <end>` | loop 구간 활성화              |
| `bpm <value>`        | session BPM 변경              |
| `master <0..1>`      | master volume 변경            |

## Track

| 명령                      | 동작              |
| ------------------------- | ----------------- |
| `track add`               | 새 track 추가     |
| `track remove <trackId>`  | track 제거        |
| `volume <trackId> <0..1>` | track volume 변경 |
| `mute <trackId> on\|off`  | track mute 변경   |
| `solo <trackId> on\|off`  | track solo 변경   |
| `pan <trackId> <-1..1>`   | track pan 변경    |

## Region

| 명령                                            | 동작                            |
| ----------------------------------------------- | ------------------------------- |
| `region add <trackId> <assetId> [startTime]`    | asset을 region으로 track에 추가 |
| `region move <trackId> <regionId> <startTime>`  | region 시작 시간 변경           |
| `region split <trackId> <regionId> <splitTime>` | region을 한 시점에서 둘로 분리  |
| `region resize <trackId> <regionId> <duration>` | region 길이 변경                |
| `region remove <trackId> <regionId>`            | region 제거                     |

## Session

| 명령                        | 동작                        |
| --------------------------- | --------------------------- |
| `session export [filename]` | 현재 session을 WAV로 export |
| `export [filename]`         | `session export` alias      |

## 예시

업로드가 끝나면 화면과 welcome text에 `assetId`, `trackId`, `regionId`가 표시된다. 실제 ID를 기준으로 명령을 입력한다.

```txt
commands
status
region split track-1 region-1 1
region move track-1 region-1 0.5
export mix.wav
```

## 현재 한계

- 기본 Web composition은 `ToneAudioEngine`을 사용한다.
- 업로드한 오디오 파일의 실제 재생과 WAV export는 브라우저에서 수동 QA가 필요하다.
- 프로젝트 저장/복원 command는 아직 없다.

## 확인 명령

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

전체 확인은 다음 명령으로 실행한다.

```sh
pnpm check
```

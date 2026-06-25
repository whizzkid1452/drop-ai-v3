# Drop AI v3 애자일 기능 우선순위

## 우선순위 기준

- 각 단계는 사용자가 끝낼 수 있는 작업 단위로 나눈다.
- 먼저 CLI에서 command 실행 경계를 검증한다.
- 그다음 AI agent를 붙여 "오디오 파일을 올리고, 필요한 구간을 지정하고, 들어보고, 구간 WAV를 받는 흐름"을 MVP로 만든다.
- MVP 이후에는 같은 command 경계를 웹 UI, 단축키로 차례로 노출한 뒤, 작업물을 잃지 않는 기능, 편집 속도를 높이는 기능, 더 복잡한 제작 기능 순서로 확장한다.
- 내부 구조 기준이 아니라 사용자 가치 기준으로 phase를 나눈다.
- 기능 구현 순서는 `TDD 테스트 작성 -> command/domain 로직 구현 -> CLI로 동작 검증 -> UI 연결`을 기본으로 한다.
- 초기 phase에서는 AI agent, 웹 UI, 단축키, CLI가 같은 command 실행 경계를 공유하게 만든다.
- script, remote controller는 core workflow와 기본 조작 surface가 안정된 뒤 확장 phase에서 붙인다.
- 한 phase는 PR 단위가 아니다. 한 phase 안에서도 기능은 사용자 가치와 리스크에 따라 여러 PR로 쪼갠다.
- MVP 완료 기준은 Phase 1 종료 시점이다. Phase 0은 MVP가 아니라 AI agent가 사용할 command 실행 경계를 준비하는 단계다.

## Phase 0. CLI command 기반 구축

AI agent를 붙이기 전에 CLI에서 command 실행 경계를 검증한다. 여기서 CLI는 문자열 입력을 command로 parse하고 `AppController.executeCommand()`로 실행하는 조작 surface를 뜻한다.

이 phase는 MVP 완료가 아니다. Phase 1의 AI agent가 재사용할 command registry, session read model, 실행 결과 형식을 먼저 고정하는 선행 단계다.

체크 기준: 현재 CLI 입력으로 실행 가능한 항목만 체크한다. controller/domain에만 존재하거나 웹 UI를 거쳐야 하는 항목은 체크하지 않는다.

- [x] CLI 오디오 파일 업로드
- [x] CLI asset 등록
  - `asset upload` / `asset register` CLI local command가 file picker adapter를 통해 `asset.register` command를 실행한다.
- [x] CLI 기본 track 생성
- [x] CLI asset-backed region 생성
- [x] CLI region move
- [x] CLI region split
- [x] CLI region resize
- [x] CLI 재생
- [x] CLI 일시정지
- [x] CLI 정지
- [x] CLI seek
- [x] CLI export 구간 시작점 설정
- [x] CLI export 구간 끝점 설정
- [x] CLI export 구간 preview 재생
- [x] CLI 구간 WAV export
  - `export range [filename]` command가 현재 export range와 교차하는 region만 WAV로 export한다.
- [x] CLI export 구간 시작점 fade in 설정
- [x] CLI export 구간 끝점 fade out 설정
- [x] fade 적용 offline render
- [x] CLI session 전체 WAV export

## Phase 1. MVP: AI agent 붙이기

사용자는 자연어 요청을 command 실행 계획으로 바꾸고, 승인한 command만 현재 session에 적용할 수 있다.

여기서 AI agent는 별도 상태 소유자가 아니라, command registry와 session read model을 사용하는 자연어 기반 조작 surface를 뜻한다.

Phase 1 종료 시점을 MVP 완료 기준으로 본다. 이때 MVP는 "사용자가 AI agent를 통해 현재 session을 이해하고, command plan을 승인한 뒤, 승인된 command로 오디오 편집과 WAV export를 수행할 수 있는 상태"를 뜻한다.

Phase 1은 Phase 0의 CLI command와 같은 command registry를 사용한다. 화면 조작 UI는 Phase 2에서 붙인다.

- agent command workflow
- agent가 사용할 command registry 노출
- agent가 읽을 session summary 제공
- 자연어 요청 입력
- command 후보 생성
- command plan preview
- command plan 사용자 승인
- 승인된 command 실행
- command 실행 결과 요약
- command 실행 실패 메시지 표시
- structured command audit log

## Phase 2. 웹 UI 붙이기

사용자는 Phase 0 workflow와 Phase 1 agent 결과를 브라우저 화면에서 확인하고 조작할 수 있다.

여기서 웹 UI는 새 편집 상태 소유자가 아니라, 같은 command 실행 경계와 session read model을 사용하는 브라우저 control surface를 뜻한다.

UI 관련 항목은 이 phase에 모은다. 표시, 선택, 드래그, range control, 다운로드 시작 같은 브라우저 사용자 조작은 Phase 0 command/domain 항목과 분리한다.

- [x] upload screen
- [x] file picker/dropzone
- [x] 오디오 파일 업로드 UI
- [x] asset 등록 UI 흐름
- [x] upload validation error UI
- [x] command-backed session creation UI
- [x] session summary panel
- [ ] waveform timeline UI
- [ ] region selection UI
- [ ] export range control UI
- [ ] export range start control UI
- [ ] export range end control UI
- [ ] export range length display UI
- [x] transport control UI
- [ ] playhead display UI
  - seek position 표시는 있으나, 재생 중 실시간 playhead UI는 아직 확인되지 않았다.
- [ ] current playback position display UI
- [ ] export preview UI
- [x] export download UI
- [x] command result feedback UI
- [x] command error feedback UI

## Phase 3. 단축키 붙이기

사용자는 반복해서 실행하는 command를 키보드 입력으로 호출하고, 단축키 충돌을 확인한 뒤 수정할 수 있다.

여기서 단축키는 DOM keyboard event를 command 실행 요청으로 매핑하는 입력 surface를 뜻한다.

- keyboard shortcut
- key binding editor
- shortcut command map
- shortcut conflict detection
- shortcut preset 저장
- shortcut preset 불러오기
- transport shortcut
- edit shortcut
- export shortcut
- shortcut help overlay

## Phase 4. 작업물을 잃지 않는 편집기

사용자는 브라우저를 닫거나 새로고침해도 작업을 다시 열 수 있고, 실수한 편집을 되돌릴 수 있다.

- project 생성
- project 열기
- project 저장
- project 자동 저장
- project 이름 변경
- recent project list
- session JSON 저장
- asset blob 저장
- project save/load
- command history
- undo
- redo
- region selection 저장
- playhead position 저장
- track order 저장
- export filename 설정
- export 전 project dirty state 표시

## Phase 5. 더 빠른 오디오 컷 편집

사용자는 여러 구간을 더 빠르게 자르고, 맞추고, 반복 편집할 수 있다.

- multi-region selection
- range selection
- marker 추가
- marker 삭제
- named marker
- grid 설정
- snap mode 설정
- zoom in
- zoom out
- zoom to selection
- timeline scroll
- region duplicate
- multi-duplicate region
- region align by start
- region align by end
- region fade in
- region fade out
- fade length 설정
- region gain 설정
- region mute
- region normalize
- reverse region
- range delete
- insert time
- remove time

## Phase 6. 멀티트랙 편집과 기본 믹싱

사용자는 여러 오디오 파일을 트랙별로 배치하고, 기본 믹스를 만든 뒤 결과물을 export할 수 있다.

- 다중 오디오 파일 업로드
- asset source list
- audio track 추가
- track 이름 변경
- track 삭제
- track order 변경
- track height 변경
- track mute
- track solo
- track volume 설정
- track pan 설정
- master volume 설정
- master meter
- per-track meter
- track color 설정
- region을 다른 track으로 이동
- track별 region 정렬
- mixdown WAV export

## Phase 7. 녹음과 캡처

사용자는 브라우저에서 새 오디오를 녹음하고, 녹음 결과를 기존 timeline에 region으로 배치할 수 있다.

- microphone permission flow
- audio input 선택
- record enable
- start recording
- stop recording
- 녹음 결과 asset 등록
- 녹음 결과 region 생성
- metronome 설정
- click enable
- count-in recording
- punch-in
- punch-out
- loop recording
- capture tagging
- last capture removal

## Phase 8. 기본 이펙트와 Processor Chain

사용자는 오디오에 기본 이펙트를 적용하고, 적용 순서를 조정하며, export 결과에서 처리된 소리를 확인할 수 있다.

- browser-native gain processor
- browser-native EQ processor
- browser-native compressor processor
- browser-native reverb processor
- processor 추가
- processor 삭제
- processor 순서 변경
- processor bypass
- processor parameter 설정
- processor preset 저장
- processor preset 불러오기
- track processor chain
- master processor chain
- processed export
- unprocessed export

## Phase 9. 고급 오디오 편집

사용자는 긴 오디오 파일에서 무음, transient, pitch, time을 기준으로 더 정교한 편집을 할 수 있다.

- strip silence
- split at transients
- place transient
- close gaps
- pitch shift
- time stretch
- region sync point 설정
- region sync point 제거
- region group
- region ungroup
- combine regions
- uncombine regions
- consolidate
- consolidate with processing
- region bounce
- selected region export
- loudness analysis
- spectral analysis

## Phase 10. Export와 외부 전달 확장

사용자는 목적에 맞는 파일 형식과 단위로 결과물을 내보낼 수 있다.

- quick export
- full export
- stem export
- region export
- WAV export 옵션
- BWAV export
- FLAC export
- Ogg Vorbis export
- MP3 export
- export sample rate 설정
- export sample format 설정
- export channel format 설정
- export normalization 설정
- export loudness target 설정
- export metadata 설정
- export preset 저장
- export preset 불러오기
- project archive

## Phase 11. MIDI 제작

사용자는 MIDI track을 만들고, note를 편집하고, instrument playback으로 결과를 들을 수 있다.

- MIDI track 추가
- instrument route
- piano roll
- MIDI note 추가
- MIDI note 삭제
- MIDI note 이동
- MIDI note 길이 변경
- MIDI note duplicate
- MIDI note selection
- MIDI note velocity 편집
- MIDI note channel 편집
- transpose by octave
- transpose by semitone
- selected notes quantize
- MIDI region quantize
- legatize
- remove overlap
- patch change insert
- Standard MIDI File import
- Standard MIDI File export
- virtual keyboard

## Phase 12. Automation, Tempo, Arrangement

사용자는 시간에 따라 mix와 effect 값을 바꾸고, tempo/meter 기반 arrangement를 만들 수 있다.

- automation lane show/hide
- automation control point 추가
- automation control point 이동
- automation control point 삭제
- track volume automation
- track pan automation
- plugin parameter automation
- send automation
- region gain envelope automation
- automation copy/paste
- automation mode 설정
- tempo map edit
- meter edit
- time-signature edit
- bars/beats/ticks ruler
- tempo ruler
- meter ruler
- primary clock mode
- secondary clock mode
- follow playhead
- stationary playhead

## Phase 13. 확장 워크플로우

사용자는 script, remote controller, headless 실행, 외부 controller로 같은 프로젝트를 조작할 수 있다.

여기서 script는 별도 AI agent가 아니라, 여러 command를 저장된 절차로 묶어 반복 실행하는 자동화 기능이다. 예를 들어 "선택 구간을 export하고 파일 이름 규칙을 적용한다" 같은 반복 작업을 사용자가 저장해두고 다시 실행하는 기능을 뜻한다.

- script manager
- script execution
- command macro recording
- command macro run
- command replay
- remote command API
- headless session open
- headless command execution
- headless export
- OSC preset support
- MIDI controller maps
- control surface profile
- plugin manager
- plugin scan result state
- video open
- video remove
- video timeline ruler
- video monitor
- video export with audio render

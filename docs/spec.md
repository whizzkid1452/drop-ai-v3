# Drop AI v3 애자일 기능 우선순위

## 우선순위 기준

- 각 단계는 사용자가 끝낼 수 있는 작업 단위로 나눈다.
- 먼저 "오디오 파일을 올리고, 편집하고, 들어보고, WAV로 받는 흐름"을 MVP로 만든다.
- 그다음에는 작업물을 잃지 않는 기능, 편집 속도를 높이는 기능, 더 복잡한 제작 기능 순서로 확장한다.
- 내부 구조 기준이 아니라 사용자 가치 기준으로 phase를 나눈다.
- 모든 쓰기 기능은 UI, CLI, shortcut, script가 같은 command 실행 경계를 공유하도록 만든다.
- 한 phase는 PR 단위가 아니다. 한 phase 안에서도 기능은 사용자 가치와 리스크에 따라 여러 PR로 쪼갠다.

## Phase 0. MVP: 오디오 파일 하나를 잘라 WAV로 내보내기

사용자는 오디오 파일 하나를 올리고, 필요한 구간을 편집하고, 재생으로 확인한 뒤 WAV 파일로 받을 수 있다.

- 오디오 파일 업로드
- asset 등록
- 기본 track 생성
- asset-backed region 생성
- waveform timeline 표시
- region 선택
- region 이동
- region 분할
- region 앞부분 trim
- region 뒷부분 trim
- region 삭제
- 재생
- 일시정지
- 정지
- seek
- playhead 표시
- 현재 재생 위치 표시
- WAV export
- export 파일 다운로드

## Phase 1. 작업물을 잃지 않는 편집기

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

## Phase 2. 더 빠른 오디오 컷 편집

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
- keyboard shortcut
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

## Phase 3. 멀티트랙 편집과 기본 믹싱

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

## Phase 4. 녹음과 캡처

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

## Phase 5. 기본 이펙트와 Processor Chain

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

## Phase 6. 고급 오디오 편집

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

## Phase 7. Export와 외부 전달 확장

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

## Phase 8. MIDI 제작

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

## Phase 9. Automation, Tempo, Arrangement

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

## Phase 10. 확장 워크플로우

사용자는 외부 도구, script, remote controller, headless 실행으로 같은 프로젝트를 조작할 수 있다.

- script manager
- script execution
- command macro recording
- command macro run
- command replay
- structured command audit log
- remote command API
- headless session open
- headless command execution
- headless export
- OSC preset support
- MIDI controller maps
- key binding editor
- control surface profile
- plugin manager
- plugin scan result state
- video open
- video remove
- video timeline ruler
- video monitor
- video export with audio render

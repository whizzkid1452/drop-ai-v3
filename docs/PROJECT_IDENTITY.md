# Drop AI v3 프로젝트 정체성

Drop AI v3는 브라우저에서 실제 오디오 파일을 업로드하고, 편집하고, 재생하고, WAV로 export할 수 있는 lightweight DAW다.

`command-first`는 제품 목표가 아니라 내부 설계 원칙이다. UI, 인앱 CLI, 향후 keyboard shortcut, agent, plugin 입력이 같은 편집 코어를 공유하도록 모든 쓰기 입력을 `AppController.executeCommand()` 경계로 통과시킨다.

## 한 줄 정체성

사람이 실제로 사용할 수 있고, 나중에 agent도 같은 command surface로 조작할 수 있는 browser DAW.

## 이 프로젝트는 무엇인가

Drop AI v3는 구조 실험만을 위한 코어가 아니다. 사용자가 브라우저에서 오디오 파일을 올리고, 재생하고, region을 편집하고, export 결과물을 얻을 수 있어야 한다.

다만 입력 경로가 늘어날 것을 전제로 한다. Web UI 버튼, 인앱 CLI 명령, keyboard shortcut, agent action이 서로 다른 방식으로 도메인을 우회하지 않게 한다. 모든 쓰기 입력은 command로 표현하고 같은 controller 경계를 통과한다.

핵심 아이디어는 다음과 같다.

> UI, CLI, agent는 모두 같은 command로 DAW session을 조작한다.

예시:

- `playback.play`
- `playback.seek`
- `track.add`
- `track.volume.set`
- `region.add`
- `region.split`
- `session.export`

이 구조를 지키면 새로운 입력 경로를 추가할 때 도메인 로직을 복제하지 않고 같은 controller 동작을 사용할 수 있다.

## 핵심 원칙

### 작동하는 DAW 우선

가장 중요한 기준은 실제 사용 흐름이다.

- 파일을 업로드하면 실제 소리가 나야 한다.
- play, pause, stop, seek가 브라우저에서 체감되어야 한다.
- region move, split, resize가 session state와 실제 재생/export에 반영되어야 한다.
- export한 WAV가 실제 오디오를 담아야 한다.
- 새로고침이나 재방문에도 최소한의 작업 상태를 잃지 않아야 한다.

구조는 이 목표를 돕기 위한 수단이다.

### Command-First

사용자가 의미 있게 수행하는 쓰기 동작은 command로 표현한다.

command 계층은 앱과 인터페이스 사이의 계약이다. UI 이벤트, CLI 입력, 향후 agent 요청은 모두 검증된 command로 변환되어 같은 controller surface를 통과해야 한다.

### Session As Source Of Truth

UI에 보여야 하는 편집 상태의 원본은 session state다.

Tone.js나 WebAudio node 내부 상태는 React가 안정적으로 읽기 어렵다. track, region, playback, mixer 상태는 session에 기록한다. audio engine은 실제 재생과 export를 담당한다.

### Ports And Adapters

controller 코드는 Tone.js, 브라우저 저장소, UI framework에 직접 의존하지 않는다.

외부 시스템은 인터페이스 뒤에 둔다.

- `IAudioEngine`은 controller가 의존하는 오디오 계약이다.
- `ToneAudioEngine`은 제품 실행 경로의 기본 구현이 되어야 한다.
- `FakeAudioEngine`은 테스트와 격리된 개발 확인을 가능하게 한다.
- IndexedDB 저장소는 persistence adapter 내부에 격리한다.

### Persistence Is Product Work

프로젝트 저장/복원은 더 이상 영구적인 non-goal이 아니다. 실제 DAW가 되기 위해 필요한 기능이다.

다만 우선순위는 실제 오디오 vertical slice가 먼저다.

1. 실제 오디오 업로드와 재생
2. 실제 region 편집 반영
3. 실제 WAV export
4. session과 asset 저장 계약 확정
5. IndexedDB 기반 save/load

## 현재 범위

완료된 기반:

- 업로드 진입 화면
- 업로드 후 기본 asset, track, region 생성
- 인앱 CLI 표시
- CLI 편집 명령
- export 명령과 다운로드 트리거
- `ToneAudioEngine` 구현과 테스트
- 기본 Web composition의 `ToneAudioEngine` 연결

아직 제품 기준으로 부족한 부분:

- 업로드한 오디오 파일의 실제 재생과 WAV export는 브라우저에서 수동 QA가 필요하다.
- timeline/waveform 기반의 직접 편집 UI는 아직 없다.
- 프로젝트 저장/복원은 아직 없다.

## 제품 방향

Drop AI v3는 작고 신뢰할 수 있는 browser DAW로 성장해야 한다.

자연스러운 다음 단계는 다음과 같다.

1. 실제 오디오 파일 기준으로 업로드, 재생, seek, stop을 수동 QA한다.
2. `session.export`가 실제 WAV를 생성하는지 확인한다.
3. transport UI를 추가한다.
4. 최소 timeline UI를 추가한다.
5. IndexedDB 기반 프로젝트 저장/복원을 추가한다.

프로젝트 정체성은 이 문장에 계속 가까워야 한다.

> 사람이 실제 오디오 작업을 끝낼 수 있고, 여러 입력 경로가 같은 command workflow를 공유하는 browser DAW.

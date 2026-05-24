# Drop AI v3 프로젝트 정체성

Drop AI v3는 TDD로 다시 만드는 command-first 브라우저 DAW 코어다.

CLI, Web UI, 그리고 향후 AI agent가 모두 하나의 명령 표면을 통해 같은
오디오 세션 모델을 조작할 수 있도록 설계한다.

## 한 줄 정체성

AI가 조작하기 좋은 DAW 코어. AI 장식 기능이 아니다.

## 이 프로젝트는 무엇인가

Drop AI v3는 처음부터 완성형 음악 제작 앱이나 풀스펙 DAW가 되려는
프로젝트가 아니다.

첫 목표는 기존 Drop AI의 동작을 더 깨끗한 아키텍처, 더 강한 테스트,
그리고 나중에 AI workflow로 확장하기 쉬운 command model로 다시 만드는
것이다.

핵심 아이디어는 단순하다.

> UI, CLI, AI는 모두 같은 명령으로 DAW를 조작한다.

예시:

- `track.add`
- `track.volume.set`
- `region.add`
- `region.split`
- `playback.bpm.set`
- `session.export`

이 구조를 지키면 Web UI 버튼, CLI 입력, AI agent가 서로 다른 길로
비즈니스 로직을 복제하지 않고 같은 컨트롤러 동작을 사용할 수 있다.

## 핵심 원칙

### Command-First

사용자가 의미 있게 수행하는 동작은 명령으로 표현할 수 있어야 한다.

명령 계층은 앱과 인터페이스 사이의 계약이다. UI 이벤트, CLI 입력,
향후 AI agent의 요청은 모두 검증된 command로 변환되어 같은 controller
surface를 통과해야 한다.

### In-Memory Session First

현재 v3 범위에서 세션은 앱이 실행되는 동안 유지되는 작업 상태다.

트랙, 리전, 재생 상태, 믹서 값, export 대상 상태는 세션 모델 안에 둔다.
하지만 프로젝트 저장, 복원, autosave, asset persistence는 초기 범위에서
제외한다.

export는 범위에 포함한다.

- `session.export`는 현재 in-memory session을 WAV로 렌더링한다.
- export는 결과물 생성이지 프로젝트 저장 기능이 아니다.

### Ports And Adapters

core와 controller 코드는 Tone.js, 브라우저 저장소, UI framework에 직접
의존하지 않는다.

외부 시스템은 인터페이스 뒤에 둔다.

- `AudioProvider`는 실제 오디오 구현 세부사항을 숨긴다.
- `FakeAudioProvider`는 결정적인 테스트를 가능하게 한다.
- `ToneAudioProvider`는 command/session model을 Tone.js에 연결한다.

이 구조 덕분에 core는 테스트하기 쉽고, 구현 선택지는 나중에 교체하기
쉬워진다.

### TDD Rebuild

이 프로젝트는 감으로 다시 쓰는 rewrite가 아니라, 테스트로 원본 동작을
다시 세우는 rebuild다.

테스트는 구현 전 또는 구현과 함께 동작 계약을 설명해야 한다. 커밋
히스토리도 시스템이 의도적으로 자라는 느낌을 가져야 한다.

- command contract 정의
- core behavior를 고립된 테스트로 추가
- fake를 통해 controller wiring 검증
- composition root 연결
- 실제 audio/export adapter 추가
- 동작이 보호된 뒤 refactor

## 현재 범위가 아닌 것

다음 기능들은 현재 v3 초기 범위가 아니다.

- 프로젝트 저장과 복원
- autosave
- IndexedDB 또는 localStorage persistence
- 클라우드 프로젝트 동기화
- 업로드한 오디오 파일을 보관, 태그, 검색하거나 여러 프로젝트에서
  재사용하는 기능
- 완성형 DAW UI polish
- AI 작곡 자동화

이 기능들은 나중에 별도 milestone이 될 수 있다. 다만 지금 core 설계는
검증 가능한 현재 제품 필요를 기준으로 작게 유지한다.

## 제품 방향

Drop AI v3는 명확한 command surface를 가진 작고 신뢰할 수 있는 DAW
engine으로 성장해야 한다.

자연스러운 다음 단계는 다음과 같다.

1. 기존 command/controller surface를 호출하는 Web UI.
2. CLI와 Web workflow를 검증하는 E2E 테스트.
3. 구현 세부사항을 직접 만지지 않고 검증된 command를 생성하는 AI agent.

프로젝트 정체성은 이 문장에 계속 가까워야 한다.

> 테스트하기 쉬울 만큼 단순하고, 자동화하기 좋을 만큼 구조적이며, 사람과
> AI가 같은 workflow를 공유할 만큼 표현력 있는 DAW 코어.

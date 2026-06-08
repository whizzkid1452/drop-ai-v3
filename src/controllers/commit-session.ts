import type { SessionState } from '@/session/session-state';
import type { ISessionStore } from '@/session/session-store';

// 미리 계산된 다음 상태를 store 에 커밋한다.
// 전제: getState() 와 이 호출 사이에 await 가 없어야 한다(동기 구간).
// 그렇지 않으면 동시에 진행된 커맨드의 업데이트를 덮어쓸 수 있다.
export function commitSession(
  store: ISessionStore,
  nextState: SessionState
): void {
  store.applyOperation(() => nextState);
}

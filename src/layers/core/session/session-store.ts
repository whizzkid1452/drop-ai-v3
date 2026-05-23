import { createStore, type StoreApi } from 'zustand/vanilla';
import type { SessionState } from './session-state';

export type SessionListener = (
  state: SessionState,
  previousState: SessionState
) => void;

export interface SessionStore {
  getState(): SessionState;
  subscribe(listener: SessionListener): () => void;
  applyOperation(transform: (state: SessionState) => SessionState): void;
  replaceState(next: SessionState): void;
}

export interface CreateSessionStoreOptions {
  initialSession: SessionState;
}

export function createSessionStore({
  initialSession,
}: CreateSessionStoreOptions): SessionStore {
  const store: StoreApi<SessionState> = createStore<SessionState>(
    () => initialSession
  );

  return {
    getState: () => store.getState(),
    subscribe: listener => store.subscribe(listener),
    applyOperation: transform => {
      store.setState(state => transform(state), true);
    },
    replaceState: next => {
      store.setState(next, true);
    },
  };
}

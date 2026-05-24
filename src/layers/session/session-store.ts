import { createStore, type StoreApi } from 'zustand/vanilla';
import type { SessionState } from './session-state';

export type SessionListener = (
  state: SessionState,
  previousState: SessionState
) => void;

export interface ISessionReader {
  getState(): SessionState;
  subscribe(listener: SessionListener): () => void;
}

export interface ISessionStore extends ISessionReader {
  applyOperation(transform: (state: SessionState) => SessionState): void;
}

export interface ICreateSessionStoreOptions {
  initialSession: SessionState;
}

export function createSessionStore({
  initialSession,
}: ICreateSessionStoreOptions): ISessionStore {
  const store: StoreApi<SessionState> = createStore<SessionState>(
    () => initialSession
  );

  return {
    getState: () => store.getState(),
    subscribe: (listener) => store.subscribe(listener),
    applyOperation: (transform) => {
      store.setState((state) => transform(state), true);
    },
  };
}

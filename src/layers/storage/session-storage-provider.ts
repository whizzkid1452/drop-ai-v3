import type { SessionState } from '@/layers/core/session/session-state';

export interface SessionStorageProvider {
  loadLatest(): Promise<SessionState | null>;
  save(session: SessionState): Promise<void>;
  clear(): Promise<void>;
}

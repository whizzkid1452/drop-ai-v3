import type { SessionState } from '@/layers/core/session/session-state';
import type { SessionStorageProvider } from './session-storage-provider';

export class MemorySessionStorage implements SessionStorageProvider {
  private snapshot: SessionState | null = null;

  async loadLatest(): Promise<SessionState | null> {
    return this.snapshot === null ? null : structuredClone(this.snapshot);
  }

  async save(session: SessionState): Promise<void> {
    this.snapshot = structuredClone(session);
  }

  async clear(): Promise<void> {
    this.snapshot = null;
  }
}

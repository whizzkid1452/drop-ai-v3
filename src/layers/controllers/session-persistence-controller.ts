import type { AudioProvider } from '@/layers/audio/audio-provider';
import type { SessionStore } from '@/layers/core/session/session-store';
import type { SessionStorageProvider } from '@/layers/storage/session-storage-provider';
import type { SessionPersistenceCommandTarget } from './command-controller';

export interface SessionPersistenceControllerDependencies {
  sessionStore: SessionStore;
  storage: SessionStorageProvider;
  audioProvider: AudioProvider;
}

export class SessionPersistenceController
  implements SessionPersistenceCommandTarget
{
  private readonly sessionStore: SessionStore;
  private readonly storage: SessionStorageProvider;
  private readonly audioProvider: AudioProvider;

  constructor(deps: SessionPersistenceControllerDependencies) {
    this.sessionStore = deps.sessionStore;
    this.storage = deps.storage;
    this.audioProvider = deps.audioProvider;
  }

  async saveSession(): Promise<void> {
    const snapshot = this.sessionStore.getState();
    const cleanSnapshot = { ...snapshot, dirty: false };
    await this.storage.save(cleanSnapshot);
    this.sessionStore.applyOperation(state => ({ ...state, dirty: false }));
  }

  async restoreSession(): Promise<{ restored: boolean }> {
    const loaded = await this.storage.loadLatest();
    if (!loaded) {
      return { restored: false };
    }
    this.sessionStore.replaceState(loaded);
    await this.audioProvider.syncSession(loaded);
    return { restored: true };
  }

  async exportSession(_filename?: string): Promise<never> {
    throw new Error('Session export is not implemented yet.');
  }
}

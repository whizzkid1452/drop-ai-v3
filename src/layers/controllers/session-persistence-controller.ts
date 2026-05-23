import type { AudioProvider } from '@/layers/audio/audio-provider';
import type {
  SessionState,
  TrackState,
} from '@/layers/core/session/session-state';
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

  async exportSession(filename?: string): Promise<{ blob: Blob; filename: string }> {
    const snapshot = this.sessionStore.getState();
    const duration = computeSessionDuration(snapshot);
    if (duration <= 0) {
      throw new Error('Cannot export an empty session.');
    }
    const blob = await this.audioProvider.exportSession(duration, snapshot);
    return {
      blob,
      filename: filename ?? `${snapshot.id}.wav`,
    };
  }
}

function computeSessionDuration(session: SessionState): number {
  let max = 0;
  for (const trackId of session.trackOrder) {
    const track: TrackState = session.tracksById[trackId];
    for (const regionId of track.regionOrder) {
      const region = track.regionsById[regionId];
      const end = region.startTime + region.duration;
      if (end > max) max = end;
    }
  }
  return max;
}

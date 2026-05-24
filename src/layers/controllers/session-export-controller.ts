import type { AudioProvider } from '@/layers/audio/audio-provider';
import type {
  SessionState,
  TrackState,
} from '@/layers/core/session/session-state';
import type { SessionStore } from '@/layers/core/session/session-store';
import type { SessionExportCommandTarget } from './command-controller';

export interface SessionExportControllerDependencies {
  sessionStore: SessionStore;
  audioProvider: AudioProvider;
}

export class SessionExportController implements SessionExportCommandTarget {
  private readonly sessionStore: SessionStore;
  private readonly audioProvider: AudioProvider;

  constructor(deps: SessionExportControllerDependencies) {
    this.sessionStore = deps.sessionStore;
    this.audioProvider = deps.audioProvider;
  }

  async exportSession(
    filename?: string
  ): Promise<{ blob: Blob; filename: string }> {
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

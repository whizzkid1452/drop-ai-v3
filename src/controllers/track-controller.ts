import type { IAudioEngine } from '@/audio-engine/audio-engine';
import { TrackNotFoundError } from '@/session/session-errors';
import { sessionOps } from '@/session/session-operations';
import type { ISessionStore } from '@/session/session-store';
import type {
  AddRegionFromAssetInput,
  MoveRegionInput,
  ResizeRegionInput,
  SplitRegionInput,
  TrackCommandTarget,
} from './command-controller';
import { commitSession } from './commit-session';
import type { IdGenerator } from './id-generator';

const DEFAULT_REGION_OFFSET = 0;

export interface TrackControllerDependencies {
  sessionStore: ISessionStore;
  audioEngine: IAudioEngine;
  idGenerator: IdGenerator;
}

export class TrackController implements TrackCommandTarget {
  private readonly sessionStore: ISessionStore;
  private readonly audioEngine: IAudioEngine;
  private readonly idGenerator: IdGenerator;

  constructor(deps: TrackControllerDependencies) {
    this.sessionStore = deps.sessionStore;
    this.audioEngine = deps.audioEngine;
    this.idGenerator = deps.idGenerator;
  }

  async addTrack(): Promise<{ id: string }> {
    const trackId = this.idGenerator.next('track');
    const nextState = sessionOps.addTrack(this.sessionStore.getState(), {
      trackId,
      name: trackId,
    });

    this.audioEngine.createTrack(trackId);
    commitSession(this.sessionStore, nextState);

    return { id: trackId };
  }

  removeTrack(trackId: string): void {
    const nextState = sessionOps.removeTrack(this.sessionStore.getState(), {
      trackId,
    });

    this.audioEngine.removeTrack(trackId);
    commitSession(this.sessionStore, nextState);
  }

  setTrackVolume(trackId: string, volume: number): void {
    const nextState = sessionOps.setTrackVolume(this.sessionStore.getState(), {
      trackId,
      volume,
    });

    this.audioEngine.setTrackVolume(trackId, volume);
    commitSession(this.sessionStore, nextState);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const nextState = sessionOps.setTrackMute(this.sessionStore.getState(), {
      trackId,
      muted,
    });

    this.audioEngine.setTrackMute(trackId, muted);
    commitSession(this.sessionStore, nextState);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    const nextState = sessionOps.setTrackSolo(this.sessionStore.getState(), {
      trackId,
      soloed,
    });

    this.audioEngine.setTrackSolo(trackId, soloed);
    commitSession(this.sessionStore, nextState);
  }

  setTrackPan(trackId: string, pan: number): void {
    const nextState = sessionOps.setTrackPan(this.sessionStore.getState(), {
      trackId,
      pan,
    });

    this.audioEngine.setTrackPan(trackId, pan);
    commitSession(this.sessionStore, nextState);
  }

  async addRegionFromAsset({
    trackId,
    assetId,
    startTime,
  }: AddRegionFromAssetInput): Promise<{ id: string }> {
    this.assertTrackExists(trackId);
    const regionId = this.idGenerator.next('region');
    const duration = await this.audioEngine.getAssetDuration(assetId);

    this.addRegionWithKnownDuration({
      trackId,
      regionId,
      assetId,
      startTime,
      duration,
    });

    return { id: regionId };
  }

  moveRegion({ trackId, regionId, startTime }: MoveRegionInput): void {
    const nextState = sessionOps.moveRegion(this.sessionStore.getState(), {
      trackId,
      regionId,
      startTime,
    });

    this.audioEngine.moveRegion({ trackId, regionId, startTime });
    commitSession(this.sessionStore, nextState);
  }

  resizeRegion({ trackId, regionId, duration }: ResizeRegionInput): void {
    const nextState = sessionOps.resizeRegion(this.sessionStore.getState(), {
      trackId,
      regionId,
      duration,
    });

    this.audioEngine.resizeRegion({ trackId, regionId, duration });
    commitSession(this.sessionStore, nextState);
  }

  removeRegion(trackId: string, regionId: string): void {
    const nextState = sessionOps.removeRegion(this.sessionStore.getState(), {
      trackId,
      regionId,
    });

    this.audioEngine.removeRegion(trackId, regionId);
    commitSession(this.sessionStore, nextState);
  }

  splitRegion({ trackId, regionId, splitTime }: SplitRegionInput): {
    leftId: string;
    rightId: string;
  } {
    const newRegionId = this.idGenerator.next('region');
    const currentState = this.sessionStore.getState();
    const nextState = sessionOps.splitRegion(currentState, {
      trackId,
      regionId,
      splitTime,
      newRegionId,
    });
    const originalRegion =
      currentState.tracksById[trackId].regionsById[regionId];
    const leftRegion = nextState.tracksById[trackId].regionsById[regionId];
    const rightRegion = nextState.tracksById[trackId].regionsById[newRegionId];

    this.audioEngine.resizeRegion({
      trackId,
      regionId,
      duration: leftRegion.duration,
    });
    try {
      this.audioEngine.addRegion({
        trackId,
        regionId: newRegionId,
        assetId: rightRegion.assetId,
        startTime: rightRegion.startTime,
        duration: rightRegion.duration,
        offset: rightRegion.offset,
      });
    } catch (error) {
      this.tryResizeAudioRegion({
        trackId,
        regionId,
        duration: originalRegion.duration,
      });
      throw error;
    }

    commitSession(this.sessionStore, nextState);

    return { leftId: regionId, rightId: newRegionId };
  }

  private assertTrackExists(trackId: string): void {
    if (!this.sessionStore.getState().tracksById[trackId]) {
      throw new TrackNotFoundError(trackId);
    }
  }

  private addRegionWithKnownDuration(input: {
    trackId: string;
    regionId: string;
    assetId: string;
    startTime: number;
    duration: number;
  }): void {
    const nextState = sessionOps.addRegion(this.sessionStore.getState(), {
      trackId: input.trackId,
      regionId: input.regionId,
      assetId: input.assetId,
      startTime: input.startTime,
      duration: input.duration,
      offset: DEFAULT_REGION_OFFSET,
    });

    this.audioEngine.addRegion({
      trackId: input.trackId,
      regionId: input.regionId,
      assetId: input.assetId,
      startTime: input.startTime,
      duration: input.duration,
      offset: DEFAULT_REGION_OFFSET,
    });
    commitSession(this.sessionStore, nextState);
  }

  private tryResizeAudioRegion(input: {
    trackId: string;
    regionId: string;
    duration: number;
  }): void {
    try {
      this.audioEngine.resizeRegion(input);
    } catch {
      return;
    }
  }
}

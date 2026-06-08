import type { IAudioEngine } from '@/audio-engine/audio-engine';
import { TrackNotFoundError } from '@/session/session-errors';
import { sessionOps } from '@/session/session-operations';
import type { SessionState } from '@/session/session-state';
import type { ISessionStore } from '@/session/session-store';
import type {
  AddRegionFromAssetInput,
  MoveRegionInput,
  ResizeRegionInput,
  SplitRegionInput,
  TrackCommandTarget,
} from './command-controller';
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

    this.audioEngine.createTrack(trackId);
    this.sessionStore.applyOperation((state) =>
      sessionOps.addTrack(state, { trackId, name: trackId })
    );

    return { id: trackId };
  }

  removeTrack(trackId: string): void {
    this.audioEngine.removeTrack(trackId);
    this.sessionStore.applyOperation((state) =>
      sessionOps.removeTrack(state, { trackId })
    );
  }

  setTrackVolume(trackId: string, volume: number): void {
    this.audioEngine.setTrackVolume(trackId, volume);
    this.sessionStore.applyOperation((state) =>
      sessionOps.setTrackVolume(state, { trackId, volume })
    );
  }

  setTrackMute(trackId: string, muted: boolean): void {
    this.audioEngine.setTrackMute(trackId, muted);
    this.sessionStore.applyOperation((state) =>
      sessionOps.setTrackMute(state, { trackId, muted })
    );
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this.audioEngine.setTrackSolo(trackId, soloed);
    this.sessionStore.applyOperation((state) =>
      sessionOps.setTrackSolo(state, { trackId, soloed })
    );
  }

  setTrackPan(trackId: string, pan: number): void {
    this.audioEngine.setTrackPan(trackId, pan);
    this.sessionStore.applyOperation((state) =>
      sessionOps.setTrackPan(state, { trackId, pan })
    );
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
    this.audioEngine.moveRegion({ trackId, regionId, startTime });
    this.sessionStore.applyOperation((state) =>
      sessionOps.moveRegion(state, { trackId, regionId, startTime })
    );
  }

  resizeRegion({ trackId, regionId, duration }: ResizeRegionInput): void {
    this.audioEngine.resizeRegion({ trackId, regionId, duration });
    this.sessionStore.applyOperation((state) =>
      sessionOps.resizeRegion(state, { trackId, regionId, duration })
    );
  }

  removeRegion(trackId: string, regionId: string): void {
    this.audioEngine.removeRegion(trackId, regionId);
    this.sessionStore.applyOperation((state) =>
      sessionOps.removeRegion(state, { trackId, regionId })
    );
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

    this.commitSession(nextState);

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
    this.audioEngine.addRegion({
      trackId: input.trackId,
      regionId: input.regionId,
      assetId: input.assetId,
      startTime: input.startTime,
      duration: input.duration,
      offset: DEFAULT_REGION_OFFSET,
    });
    this.sessionStore.applyOperation((state) =>
      sessionOps.addRegion(state, {
        trackId: input.trackId,
        regionId: input.regionId,
        assetId: input.assetId,
        startTime: input.startTime,
        duration: input.duration,
        offset: DEFAULT_REGION_OFFSET,
      })
    );
  }

  // splitRegion commits a precomputed snapshot because its audio calls and
  // rollback derive from nextState; the other mutators recompute at commit.
  private commitSession(nextState: SessionState): void {
    this.sessionStore.applyOperation(() => nextState);
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

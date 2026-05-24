import type { IAudioEngine } from '@/layers/audio-engine/audio-engine';
import { TrackNotFoundError } from '@/layers/session/session-errors';
import { sessionOps } from '@/layers/session/session-operations';
import type { ISessionStore } from '@/layers/session/session-store';
import type { TrackCommandTarget } from './command-controller';
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

    this.sessionStore.applyOperation((state) =>
      sessionOps.addTrack(state, { trackId, name: trackId })
    );
    this.audioEngine.createTrack(trackId);

    return { id: trackId };
  }

  removeTrack(trackId: string): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.removeTrack(state, { trackId })
    );
    this.audioEngine.removeTrack(trackId);
  }

  setTrackVolume(trackId: string, volume: number): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setTrackVolume(state, { trackId, volume })
    );
    this.audioEngine.setTrackVolume(trackId, volume);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setTrackMute(state, { trackId, muted })
    );
    this.audioEngine.setTrackMute(trackId, muted);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setTrackSolo(state, { trackId, soloed })
    );
    this.audioEngine.setTrackSolo(trackId, soloed);
  }

  setTrackPan(trackId: string, pan: number): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setTrackPan(state, { trackId, pan })
    );
    this.audioEngine.setTrackPan(trackId, pan);
  }

  async addRegionFromAsset(
    trackId: string,
    assetId: string,
    startTime: number
  ): Promise<{ id: string }> {
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

  async addRegionFromFile(
    trackId: string,
    file: File,
    startTime: number
  ): Promise<{ assetId: string; regionId: string }> {
    this.assertTrackExists(trackId);
    const assetId = this.idGenerator.next('asset');
    const regionId = this.idGenerator.next('region');
    const { duration } = await this.audioEngine.importFileAsset(assetId, file);

    this.addRegionWithKnownDuration({
      trackId,
      regionId,
      assetId,
      startTime,
      duration,
    });

    return { assetId, regionId };
  }

  moveRegion(trackId: string, regionId: string, startTime: number): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.moveRegion(state, { trackId, regionId, startTime })
    );
    this.audioEngine.moveRegion(trackId, regionId, startTime);
  }

  resizeRegion(trackId: string, regionId: string, duration: number): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.resizeRegion(state, { trackId, regionId, duration })
    );
    this.audioEngine.resizeRegion(trackId, regionId, duration);
  }

  removeRegion(trackId: string, regionId: string): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.removeRegion(state, { trackId, regionId })
    );
    this.audioEngine.removeRegion(trackId, regionId);
  }

  splitRegion(
    trackId: string,
    regionId: string,
    splitTime: number
  ): { leftId: string; rightId: string } {
    const newRegionId = this.idGenerator.next('region');

    this.sessionStore.applyOperation((state) =>
      sessionOps.splitRegion(state, {
        trackId,
        regionId,
        splitTime,
        newRegionId,
      })
    );

    const nextState = this.sessionStore.getState();
    const leftRegion = nextState.tracksById[trackId].regionsById[regionId];
    const rightRegion = nextState.tracksById[trackId].regionsById[newRegionId];

    this.audioEngine.resizeRegion(trackId, regionId, leftRegion.duration);
    this.audioEngine.addRegion({
      trackId,
      regionId: newRegionId,
      assetId: rightRegion.assetId,
      startTime: rightRegion.startTime,
      duration: rightRegion.duration,
      offset: rightRegion.offset,
    });

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
    this.audioEngine.addRegion({
      trackId: input.trackId,
      regionId: input.regionId,
      assetId: input.assetId,
      startTime: input.startTime,
      duration: input.duration,
      offset: DEFAULT_REGION_OFFSET,
    });
  }
}

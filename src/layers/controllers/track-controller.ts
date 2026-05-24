import type { AudioProvider } from '@/layers/audio/audio-provider';
import { sessionOps } from '@/layers/core/session/session-operations';
import type { SessionStore } from '@/layers/core/session/session-store';
import type { TrackCommandTarget } from './command-controller';
import type { IdGenerator } from './id-generator';
import type { NowProvider } from './now-provider';

const DEFAULT_REGION_OFFSET = 0;

export interface TrackControllerDependencies {
  sessionStore: SessionStore;
  audioProvider: AudioProvider;
  idGenerator: IdGenerator;
  now: NowProvider;
}

export class TrackController implements TrackCommandTarget {
  private readonly sessionStore: SessionStore;
  private readonly audioProvider: AudioProvider;
  private readonly idGenerator: IdGenerator;
  private readonly now: NowProvider;

  constructor(deps: TrackControllerDependencies) {
    this.sessionStore = deps.sessionStore;
    this.audioProvider = deps.audioProvider;
    this.idGenerator = deps.idGenerator;
    this.now = deps.now;
  }

  async addTrack(): Promise<{ id: string }> {
    const trackId = this.idGenerator.next('track');
    const now = this.now();

    this.sessionStore.applyOperation(state =>
      sessionOps.addTrack(state, { trackId, name: trackId, now })
    );
    this.audioProvider.createTrack(trackId);

    return { id: trackId };
  }

  removeTrack(trackId: string): void {
    const now = this.now();

    this.sessionStore.applyOperation(state =>
      sessionOps.removeTrack(state, { trackId, now })
    );
    this.audioProvider.removeTrack(trackId);
  }

  setTrackVolume(trackId: string, volume: number): void {
    const now = this.now();
    this.sessionStore.applyOperation(state =>
      sessionOps.setTrackVolume(state, { trackId, volume, now })
    );
    this.audioProvider.setTrackVolume(trackId, volume);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const now = this.now();
    this.sessionStore.applyOperation(state =>
      sessionOps.setTrackMute(state, { trackId, muted, now })
    );
    this.audioProvider.setTrackMute(trackId, muted);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    const now = this.now();
    this.sessionStore.applyOperation(state =>
      sessionOps.setTrackSolo(state, { trackId, soloed, now })
    );
    this.audioProvider.setTrackSolo(trackId, soloed);
  }

  setTrackPan(trackId: string, pan: number): void {
    const now = this.now();
    this.sessionStore.applyOperation(state =>
      sessionOps.setTrackPan(state, { trackId, pan, now })
    );
    this.audioProvider.setTrackPan(trackId, pan);
  }

  async addRegionFromAsset(
    trackId: string,
    assetId: string,
    startTime: number
  ): Promise<{ id: string }> {
    const regionId = this.idGenerator.next('region');
    const duration = await this.audioProvider.getAssetDuration(assetId);
    const now = this.now();

    this.sessionStore.applyOperation(state =>
      sessionOps.addRegion(state, {
        trackId,
        regionId,
        assetId,
        startTime,
        duration,
        offset: DEFAULT_REGION_OFFSET,
        now,
      })
    );
    this.audioProvider.addRegion({
      trackId,
      regionId,
      assetId,
      startTime,
      duration,
      offset: DEFAULT_REGION_OFFSET,
    });

    return { id: regionId };
  }

  moveRegion(trackId: string, regionId: string, startTime: number): void {
    const now = this.now();
    this.sessionStore.applyOperation(state =>
      sessionOps.moveRegion(state, { trackId, regionId, startTime, now })
    );
    this.audioProvider.moveRegion(trackId, regionId, startTime);
  }

  resizeRegion(trackId: string, regionId: string, duration: number): void {
    const now = this.now();
    this.sessionStore.applyOperation(state =>
      sessionOps.resizeRegion(state, { trackId, regionId, duration, now })
    );
    this.audioProvider.resizeRegion(trackId, regionId, duration);
  }

  removeRegion(trackId: string, regionId: string): void {
    const now = this.now();
    this.sessionStore.applyOperation(state =>
      sessionOps.removeRegion(state, { trackId, regionId, now })
    );
    this.audioProvider.removeRegion(trackId, regionId);
  }

  splitRegion(
    trackId: string,
    regionId: string,
    splitTime: number
  ): { leftId: string; rightId: string } {
    const newRegionId = this.idGenerator.next('region');
    const now = this.now();

    this.sessionStore.applyOperation(state =>
      sessionOps.splitRegion(state, { trackId, regionId, splitTime, newRegionId, now })
    );

    const nextState = this.sessionStore.getState();
    const leftRegion = nextState.tracksById[trackId].regionsById[regionId];
    const rightRegion = nextState.tracksById[trackId].regionsById[newRegionId];

    this.audioProvider.resizeRegion(trackId, regionId, leftRegion.duration);
    this.audioProvider.addRegion({
      trackId,
      regionId: newRegionId,
      assetId: rightRegion.assetId,
      startTime: rightRegion.startTime,
      duration: rightRegion.duration,
      offset: rightRegion.offset,
    });

    return { leftId: regionId, rightId: newRegionId };
  }
}

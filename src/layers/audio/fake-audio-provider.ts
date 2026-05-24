import type { CallRecorder } from '@/layers/testing/call-recorder';
import type { SessionState } from '@/layers/core/session/session-state';
import type {
  AddAudioRegionInput,
  AudioProvider,
  ImportFileAssetResult,
  LoopRange,
} from './audio-provider';

const DEFAULT_ASSET_DURATION_SECONDS = 1;

export interface FakeAudioProviderOptions {
  recorder?: CallRecorder;
  assetDurations?: Record<string, number>;
}

export class FakeAudioProvider implements AudioProvider {
  private readonly recorder: CallRecorder | undefined;
  private readonly assetDurations: Record<string, number>;

  constructor(options: FakeAudioProviderOptions = {}) {
    this.recorder = options.recorder;
    this.assetDurations = options.assetDurations ?? {};
  }

  private record(method: string, args: unknown[] = []): void {
    this.recorder?.record(method, args);
  }

  async play(): Promise<void> {
    this.record('play');
  }

  pause(): void {
    this.record('pause');
  }

  stop(): void {
    this.record('stop');
  }

  seek(seconds: number): void {
    this.record('seek', [seconds]);
  }

  setBpm(bpm: number): void {
    this.record('setBpm', [bpm]);
  }

  setMasterVolume(volume: number): void {
    this.record('setMasterVolume', [volume]);
  }

  setLoop(loop: LoopRange): void {
    this.record('setLoop', [loop]);
  }

  createTrack(trackId: string): void {
    this.record('createTrack', [trackId]);
  }

  removeTrack(trackId: string): void {
    this.record('removeTrack', [trackId]);
  }

  setTrackVolume(trackId: string, volume: number): void {
    this.record('setTrackVolume', [trackId, volume]);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    this.record('setTrackMute', [trackId, muted]);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this.record('setTrackSolo', [trackId, soloed]);
  }

  setTrackPan(trackId: string, pan: number): void {
    this.record('setTrackPan', [trackId, pan]);
  }

  addRegion(input: AddAudioRegionInput): void {
    this.record('addRegion', [input]);
  }

  removeRegion(trackId: string, regionId: string): void {
    this.record('removeRegion', [trackId, regionId]);
  }

  moveRegion(trackId: string, regionId: string, startTime: number): void {
    this.record('moveRegion', [trackId, regionId, startTime]);
  }

  resizeRegion(trackId: string, regionId: string, duration: number): void {
    this.record('resizeRegion', [trackId, regionId, duration]);
  }

  async getAssetDuration(assetId: string): Promise<number> {
    this.record('getAssetDuration', [assetId]);
    return this.assetDurations[assetId] ?? DEFAULT_ASSET_DURATION_SECONDS;
  }

  async importFileAsset(
    assetId: string,
    file: File
  ): Promise<ImportFileAssetResult> {
    this.record('importFileAsset', [assetId, file]);
    const duration =
      this.assetDurations[assetId] ?? DEFAULT_ASSET_DURATION_SECONDS;
    this.assetDurations[assetId] = duration;
    return { duration };
  }

  async exportSession(
    durationSeconds: number,
    session: SessionState
  ): Promise<Blob> {
    this.record('exportSession', [durationSeconds, session.id]);
    return new Blob([], { type: 'audio/wav' });
  }
}

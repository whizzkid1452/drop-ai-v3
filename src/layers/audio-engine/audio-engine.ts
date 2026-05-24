import type { SessionState } from '@/layers/session/session-state';

export interface AddAudioRegionInput {
  trackId: string;
  regionId: string;
  assetId: string;
  startTime: number;
  duration: number;
  offset: number;
}

export interface ImportFileAssetResult {
  duration: number;
}

export interface LoopRange {
  start: number;
  end: number;
  enabled: boolean;
}

export interface IAudioEngine {
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;

  setBpm(bpm: number): void;
  setMasterVolume(volume: number): void;
  setLoop(loop: LoopRange): void;

  createTrack(trackId: string): void;
  removeTrack(trackId: string): void;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackMute(trackId: string, muted: boolean): void;
  setTrackSolo(trackId: string, soloed: boolean): void;
  setTrackPan(trackId: string, pan: number): void;

  addRegion(input: AddAudioRegionInput): void;
  removeRegion(trackId: string, regionId: string): void;
  moveRegion(trackId: string, regionId: string, startTime: number): void;
  resizeRegion(trackId: string, regionId: string, duration: number): void;

  getAssetDuration(assetId: string): Promise<number>;
  importFileAsset(assetId: string, file: File): Promise<ImportFileAssetResult>;
  exportSession(durationSeconds: number, session: SessionState): Promise<Blob>;
}

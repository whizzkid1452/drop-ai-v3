export interface RegionState {
  id: string;
  assetId: string;
  startTime: number;
  duration: number;
  offset: number;
}

export interface TrackState {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  soloed: boolean;
  pan: number;
  regionOrder: string[];
  regionsById: Record<string, RegionState>;
}

export interface LoopState {
  start: number;
  end: number;
  enabled: boolean;
}

export interface PlaybackState {
  playing: boolean;
  positionSeconds: number;
  bpm: number;
  masterVolume: number;
  loop: LoopState;
}

export interface ExportRangeState {
  startSeconds: number;
  endSeconds: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
}

export interface SessionState {
  id: string;
  trackOrder: string[];
  tracksById: Record<string, TrackState>;
  playback: PlaybackState;
  exportRange: ExportRangeState;
}

export interface CreateEmptySessionInput {
  id: string;
}

const DEFAULT_BPM = 120;
const DEFAULT_MASTER_VOLUME = 1;
const DEFAULT_LOOP_START = 0;
const DEFAULT_LOOP_END = 4;
const DEFAULT_EXPORT_RANGE_START = 0;
const DEFAULT_EXPORT_RANGE_END = 4;
const DEFAULT_EXPORT_FADE_SECONDS = 0;

export function createEmptySession(
  input: CreateEmptySessionInput
): SessionState {
  return {
    id: input.id,
    trackOrder: [],
    tracksById: {},
    playback: {
      playing: false,
      positionSeconds: 0,
      bpm: DEFAULT_BPM,
      masterVolume: DEFAULT_MASTER_VOLUME,
      loop: {
        start: DEFAULT_LOOP_START,
        end: DEFAULT_LOOP_END,
        enabled: false,
      },
    },
    exportRange: {
      startSeconds: DEFAULT_EXPORT_RANGE_START,
      endSeconds: DEFAULT_EXPORT_RANGE_END,
      fadeInSeconds: DEFAULT_EXPORT_FADE_SECONDS,
      fadeOutSeconds: DEFAULT_EXPORT_FADE_SECONDS,
    },
  };
}

import { RegionNotFoundError, TrackNotFoundError } from './session-errors';
import type { RegionState, SessionState, TrackState } from './session-state';

const DEFAULT_TRACK_VOLUME = 1;
const DEFAULT_TRACK_PAN = 0;

export interface AddTrackInput {
  trackId: string;
  name: string;
  now: string;
}

export function addTrack(
  state: SessionState,
  input: AddTrackInput
): SessionState {
  const newTrack: TrackState = {
    id: input.trackId,
    name: input.name,
    volume: DEFAULT_TRACK_VOLUME,
    muted: false,
    soloed: false,
    pan: DEFAULT_TRACK_PAN,
    regionOrder: [],
    regionsById: {},
  };

  return {
    ...state,
    trackOrder: [...state.trackOrder, input.trackId],
    tracksById: {
      ...state.tracksById,
      [input.trackId]: newTrack,
    },
    dirty: true,
    updatedAt: input.now,
  };
}

export interface RemoveTrackInput {
  trackId: string;
  now: string;
}

export function removeTrack(
  state: SessionState,
  input: RemoveTrackInput
): SessionState {
  if (!(input.trackId in state.tracksById)) {
    throw new TrackNotFoundError(input.trackId);
  }

  const { [input.trackId]: _removed, ...remainingTracks } = state.tracksById;

  return {
    ...state,
    trackOrder: state.trackOrder.filter(id => id !== input.trackId),
    tracksById: remainingTracks,
    dirty: true,
    updatedAt: input.now,
  };
}

function updateTrack(
  state: SessionState,
  trackId: string,
  now: string,
  patch: (track: TrackState) => TrackState
): SessionState {
  const existingTrack = state.tracksById[trackId];
  if (!existingTrack) {
    throw new TrackNotFoundError(trackId);
  }

  return {
    ...state,
    tracksById: {
      ...state.tracksById,
      [trackId]: patch(existingTrack),
    },
    dirty: true,
    updatedAt: now,
  };
}

export interface SetTrackVolumeInput {
  trackId: string;
  volume: number;
  now: string;
}

export function setTrackVolume(
  state: SessionState,
  input: SetTrackVolumeInput
): SessionState {
  return updateTrack(state, input.trackId, input.now, track => ({
    ...track,
    volume: input.volume,
  }));
}

export interface SetTrackMuteInput {
  trackId: string;
  muted: boolean;
  now: string;
}

export function setTrackMute(
  state: SessionState,
  input: SetTrackMuteInput
): SessionState {
  return updateTrack(state, input.trackId, input.now, track => ({
    ...track,
    muted: input.muted,
  }));
}

export interface SetTrackSoloInput {
  trackId: string;
  soloed: boolean;
  now: string;
}

export function setTrackSolo(
  state: SessionState,
  input: SetTrackSoloInput
): SessionState {
  return updateTrack(state, input.trackId, input.now, track => ({
    ...track,
    soloed: input.soloed,
  }));
}

export interface SetTrackPanInput {
  trackId: string;
  pan: number;
  now: string;
}

export function setTrackPan(
  state: SessionState,
  input: SetTrackPanInput
): SessionState {
  return updateTrack(state, input.trackId, input.now, track => ({
    ...track,
    pan: input.pan,
  }));
}

export interface AddRegionInput {
  trackId: string;
  regionId: string;
  assetId: string;
  startTime: number;
  duration: number;
  offset: number;
  now: string;
}

export function addRegion(
  state: SessionState,
  input: AddRegionInput
): SessionState {
  return updateTrack(state, input.trackId, input.now, track => ({
    ...track,
    regionOrder: [...track.regionOrder, input.regionId],
    regionsById: {
      ...track.regionsById,
      [input.regionId]: {
        id: input.regionId,
        assetId: input.assetId,
        startTime: input.startTime,
        duration: input.duration,
        offset: input.offset,
      },
    },
  }));
}

function updateRegion(
  state: SessionState,
  trackId: string,
  regionId: string,
  now: string,
  patch: (region: RegionState) => RegionState
): SessionState {
  return updateTrack(state, trackId, now, track => {
    const existingRegion = track.regionsById[regionId];
    if (!existingRegion) {
      throw new RegionNotFoundError(trackId, regionId);
    }
    return {
      ...track,
      regionsById: {
        ...track.regionsById,
        [regionId]: patch(existingRegion),
      },
    };
  });
}

export interface MoveRegionInput {
  trackId: string;
  regionId: string;
  startTime: number;
  now: string;
}

export function moveRegion(
  state: SessionState,
  input: MoveRegionInput
): SessionState {
  return updateRegion(
    state,
    input.trackId,
    input.regionId,
    input.now,
    region => ({ ...region, startTime: input.startTime })
  );
}

export interface ResizeRegionInput {
  trackId: string;
  regionId: string;
  duration: number;
  now: string;
}

export function resizeRegion(
  state: SessionState,
  input: ResizeRegionInput
): SessionState {
  if (input.duration <= 0) {
    throw new Error(`Region duration must be positive: ${input.duration}`);
  }
  return updateRegion(
    state,
    input.trackId,
    input.regionId,
    input.now,
    region => ({ ...region, duration: input.duration })
  );
}

export interface RemoveRegionInput {
  trackId: string;
  regionId: string;
  now: string;
}

export function removeRegion(
  state: SessionState,
  input: RemoveRegionInput
): SessionState {
  return updateTrack(state, input.trackId, input.now, track => {
    if (!(input.regionId in track.regionsById)) {
      throw new RegionNotFoundError(input.trackId, input.regionId);
    }
    const { [input.regionId]: _removed, ...remainingRegions } =
      track.regionsById;
    return {
      ...track,
      regionOrder: track.regionOrder.filter(id => id !== input.regionId),
      regionsById: remainingRegions,
    };
  });
}

export interface SplitRegionInput {
  trackId: string;
  regionId: string;
  splitTime: number;
  newRegionId: string;
  now: string;
}

export interface SetPlayingInput {
  playing: boolean;
}

export function setPlaying(
  state: SessionState,
  input: SetPlayingInput
): SessionState {
  return {
    ...state,
    playback: { ...state.playback, playing: input.playing },
  };
}

export interface SetPositionInput {
  positionSeconds: number;
}

export function setPosition(
  state: SessionState,
  input: SetPositionInput
): SessionState {
  return {
    ...state,
    playback: { ...state.playback, positionSeconds: input.positionSeconds },
  };
}

export interface SetBpmInput {
  bpm: number;
  now: string;
}

export function setBpm(state: SessionState, input: SetBpmInput): SessionState {
  if (input.bpm <= 0) {
    throw new Error(`Bpm must be positive: ${input.bpm}`);
  }
  return {
    ...state,
    playback: { ...state.playback, bpm: input.bpm },
    dirty: true,
    updatedAt: input.now,
  };
}

export interface SetMasterVolumeInput {
  volume: number;
  now: string;
}

export function setMasterVolume(
  state: SessionState,
  input: SetMasterVolumeInput
): SessionState {
  if (input.volume < 0 || input.volume > 1) {
    throw new Error(`Master volume must be in [0, 1]: ${input.volume}`);
  }
  return {
    ...state,
    playback: { ...state.playback, masterVolume: input.volume },
    dirty: true,
    updatedAt: input.now,
  };
}

export interface SetLoopInput {
  start: number;
  end: number;
  enabled: boolean;
  now: string;
}

export function setLoop(
  state: SessionState,
  input: SetLoopInput
): SessionState {
  if (input.enabled && input.end <= input.start) {
    throw new Error(
      `Loop end must be greater than start when enabled: start=${input.start} end=${input.end}`
    );
  }
  return {
    ...state,
    playback: {
      ...state.playback,
      loop: { start: input.start, end: input.end, enabled: input.enabled },
    },
    dirty: true,
    updatedAt: input.now,
  };
}

export function splitRegion(
  state: SessionState,
  input: SplitRegionInput
): SessionState {
  return updateTrack(state, input.trackId, input.now, track => {
    const originalRegion = track.regionsById[input.regionId];
    if (!originalRegion) {
      throw new RegionNotFoundError(input.trackId, input.regionId);
    }

    const regionEnd = originalRegion.startTime + originalRegion.duration;
    if (input.splitTime <= originalRegion.startTime || input.splitTime >= regionEnd) {
      throw new Error(
        `Cannot split region ${input.regionId} at ${input.splitTime}: must be strictly inside (${originalRegion.startTime}, ${regionEnd}).`
      );
    }

    const leftDuration = input.splitTime - originalRegion.startTime;

    const leftRegion: RegionState = {
      ...originalRegion,
      duration: leftDuration,
    };

    const rightRegion: RegionState = {
      id: input.newRegionId,
      assetId: originalRegion.assetId,
      startTime: input.splitTime,
      duration: originalRegion.duration - leftDuration,
      offset: originalRegion.offset + leftDuration,
    };

    const insertionIndex = track.regionOrder.indexOf(input.regionId);
    const nextRegionOrder = [
      ...track.regionOrder.slice(0, insertionIndex + 1),
      input.newRegionId,
      ...track.regionOrder.slice(insertionIndex + 1),
    ];

    return {
      ...track,
      regionOrder: nextRegionOrder,
      regionsById: {
        ...track.regionsById,
        [input.regionId]: leftRegion,
        [input.newRegionId]: rightRegion,
      },
    };
  });
}

export const sessionOps = {
  addTrack,
  removeTrack,
  setTrackVolume,
  setTrackMute,
  setTrackSolo,
  setTrackPan,
  addRegion,
  moveRegion,
  resizeRegion,
  removeRegion,
  splitRegion,
  setPlaying,
  setPosition,
  setBpm,
  setMasterVolume,
  setLoop,
};

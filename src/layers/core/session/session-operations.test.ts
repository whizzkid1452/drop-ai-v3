import { describe, expect, it } from 'vitest';
import {
  addRegion,
  addTrack,
  moveRegion,
  removeRegion,
  removeTrack,
  resizeRegion,
  setTrackMute,
  setTrackPan,
  setTrackSolo,
  setTrackVolume,
  setBpm,
  setLoop,
  setMasterVolume,
  setPlaying,
  setPosition,
  splitRegion,
} from './session-operations';
import { RegionNotFoundError, TrackNotFoundError } from './session-errors';
import { createEmptySession } from './session-state';

const INITIAL_NOW = '2026-05-23T00:00:00.000Z';
const NEXT_NOW = '2026-05-23T00:01:00.000Z';

function freshSession() {
  return createEmptySession({ id: 'session-1', now: INITIAL_NOW });
}

describe('addTrack', () => {
  it('appends the new track id to trackOrder', () => {
    const session = freshSession();

    const result = addTrack(session, {
      trackId: 'track-1',
      name: 'Drums',
      now: NEXT_NOW,
    });

    expect(result.trackOrder).toEqual(['track-1']);
  });

  it('creates a tracksById entry with default mixer values and no regions', () => {
    const session = freshSession();

    const result = addTrack(session, {
      trackId: 'track-1',
      name: 'Drums',
      now: NEXT_NOW,
    });

    expect(result.tracksById['track-1']).toEqual({
      id: 'track-1',
      name: 'Drums',
      volume: 1,
      muted: false,
      soloed: false,
      pan: 0,
      regionOrder: [],
      regionsById: {},
    });
  });

  it('does not mutate the input state', () => {
    const session = freshSession();
    const snapshotBefore = JSON.parse(JSON.stringify(session));

    addTrack(session, { trackId: 'track-1', name: 'Drums', now: NEXT_NOW });

    expect(session).toEqual(snapshotBefore);
  });

  it('marks the resulting session dirty', () => {
    const session = freshSession();

    const result = addTrack(session, {
      trackId: 'track-1',
      name: 'Drums',
      now: NEXT_NOW,
    });

    expect(result.dirty).toBe(true);
  });

  it('updates updatedAt to the provided now', () => {
    const session = freshSession();

    const result = addTrack(session, {
      trackId: 'track-1',
      name: 'Drums',
      now: NEXT_NOW,
    });

    expect(result.updatedAt).toBe(NEXT_NOW);
  });

  it('preserves order when adding multiple tracks', () => {
    const session = freshSession();

    const afterFirst = addTrack(session, {
      trackId: 'track-1',
      name: 'A',
      now: NEXT_NOW,
    });
    const afterSecond = addTrack(afterFirst, {
      trackId: 'track-2',
      name: 'B',
      now: NEXT_NOW,
    });

    expect(afterSecond.trackOrder).toEqual(['track-1', 'track-2']);
  });
});

describe('removeTrack', () => {
  function sessionWithTwoTracks() {
    const base = createEmptySession({
      id: 'session-1',
      now: INITIAL_NOW,
    });
    const afterFirst = addTrack(base, {
      trackId: 'track-1',
      name: 'A',
      now: NEXT_NOW,
    });
    return addTrack(afterFirst, {
      trackId: 'track-2',
      name: 'B',
      now: NEXT_NOW,
    });
  }

  it('removes the trackId from trackOrder', () => {
    const session = sessionWithTwoTracks();

    const result = removeTrack(session, {
      trackId: 'track-1',
      now: NEXT_NOW,
    });

    expect(result.trackOrder).toEqual(['track-2']);
  });

  it('removes the track entry from tracksById', () => {
    const session = sessionWithTwoTracks();

    const result = removeTrack(session, {
      trackId: 'track-1',
      now: NEXT_NOW,
    });

    expect(result.tracksById['track-1']).toBeUndefined();
    expect(result.tracksById['track-2']).toBeDefined();
  });

  it('throws TrackNotFoundError when the track does not exist', () => {
    const session = sessionWithTwoTracks();

    expect(() =>
      removeTrack(session, { trackId: 'missing-track', now: NEXT_NOW })
    ).toThrow(TrackNotFoundError);
  });

  it('marks the resulting session dirty', () => {
    const session = sessionWithTwoTracks();

    const result = removeTrack(session, {
      trackId: 'track-1',
      now: NEXT_NOW,
    });

    expect(result.dirty).toBe(true);
  });

  it('updates updatedAt to the provided now', () => {
    const session = sessionWithTwoTracks();

    const result = removeTrack(session, {
      trackId: 'track-1',
      now: NEXT_NOW,
    });

    expect(result.updatedAt).toBe(NEXT_NOW);
  });

  it('does not mutate the input state', () => {
    const session = sessionWithTwoTracks();
    const snapshotBefore = JSON.parse(JSON.stringify(session));

    removeTrack(session, { trackId: 'track-1', now: NEXT_NOW });

    expect(session).toEqual(snapshotBefore);
  });
});

function sessionWithOneTrack() {
  const base = createEmptySession({
    id: 'session-1',
    now: INITIAL_NOW,
  });
  return addTrack(base, {
    trackId: 'track-1',
    name: 'A',
    now: NEXT_NOW,
  });
}

describe('setTrackVolume', () => {
  it('updates the volume on the target track', () => {
    const session = sessionWithOneTrack();

    const result = setTrackVolume(session, {
      trackId: 'track-1',
      volume: 0.5,
      now: NEXT_NOW,
    });

    expect(result.tracksById['track-1'].volume).toBe(0.5);
  });

  it('marks the resulting session dirty and updates updatedAt', () => {
    const session = sessionWithOneTrack();

    const result = setTrackVolume(session, {
      trackId: 'track-1',
      volume: 0.5,
      now: NEXT_NOW,
    });

    expect(result.dirty).toBe(true);
    expect(result.updatedAt).toBe(NEXT_NOW);
  });

  it('throws TrackNotFoundError when the track does not exist', () => {
    const session = sessionWithOneTrack();

    expect(() =>
      setTrackVolume(session, {
        trackId: 'missing',
        volume: 0.5,
        now: NEXT_NOW,
      })
    ).toThrow(TrackNotFoundError);
  });
});

describe('setTrackMute', () => {
  it('updates the muted flag on the target track', () => {
    const session = sessionWithOneTrack();

    const result = setTrackMute(session, {
      trackId: 'track-1',
      muted: true,
      now: NEXT_NOW,
    });

    expect(result.tracksById['track-1'].muted).toBe(true);
  });

  it('marks dirty and updates updatedAt', () => {
    const session = sessionWithOneTrack();

    const result = setTrackMute(session, {
      trackId: 'track-1',
      muted: true,
      now: NEXT_NOW,
    });

    expect(result.dirty).toBe(true);
    expect(result.updatedAt).toBe(NEXT_NOW);
  });

  it('throws TrackNotFoundError on missing track', () => {
    const session = sessionWithOneTrack();

    expect(() =>
      setTrackMute(session, {
        trackId: 'missing',
        muted: true,
        now: NEXT_NOW,
      })
    ).toThrow(TrackNotFoundError);
  });
});

describe('setTrackSolo', () => {
  it('updates the soloed flag on the target track', () => {
    const session = sessionWithOneTrack();

    const result = setTrackSolo(session, {
      trackId: 'track-1',
      soloed: true,
      now: NEXT_NOW,
    });

    expect(result.tracksById['track-1'].soloed).toBe(true);
  });

  it('throws TrackNotFoundError on missing track', () => {
    const session = sessionWithOneTrack();

    expect(() =>
      setTrackSolo(session, {
        trackId: 'missing',
        soloed: true,
        now: NEXT_NOW,
      })
    ).toThrow(TrackNotFoundError);
  });
});

describe('setTrackPan', () => {
  it('updates the pan on the target track', () => {
    const session = sessionWithOneTrack();

    const result = setTrackPan(session, {
      trackId: 'track-1',
      pan: -0.5,
      now: NEXT_NOW,
    });

    expect(result.tracksById['track-1'].pan).toBe(-0.5);
  });

  it('throws TrackNotFoundError on missing track', () => {
    const session = sessionWithOneTrack();

    expect(() =>
      setTrackPan(session, {
        trackId: 'missing',
        pan: 0,
        now: NEXT_NOW,
      })
    ).toThrow(TrackNotFoundError);
  });
});

describe('addRegion', () => {
  function addFirstRegion(
    session = sessionWithOneTrack(),
    regionId = 'region-1',
    startTime = 0
  ) {
    return addRegion(session, {
      trackId: 'track-1',
      regionId,
      assetId: 'asset-1',
      startTime,
      duration: 2,
      offset: 0,
      now: NEXT_NOW,
    });
  }

  it('appends the regionId to the track regionOrder', () => {
    const result = addFirstRegion();

    expect(result.tracksById['track-1'].regionOrder).toEqual(['region-1']);
  });

  it('creates a regionsById entry with the provided fields', () => {
    const result = addFirstRegion();

    expect(result.tracksById['track-1'].regionsById['region-1']).toEqual({
      id: 'region-1',
      assetId: 'asset-1',
      startTime: 0,
      duration: 2,
      offset: 0,
    });
  });

  it('throws TrackNotFoundError when the track does not exist', () => {
    const session = sessionWithOneTrack();

    expect(() =>
      addRegion(session, {
        trackId: 'missing-track',
        regionId: 'region-1',
        assetId: 'asset-1',
        startTime: 0,
        duration: 2,
        offset: 0,
        now: NEXT_NOW,
      })
    ).toThrow(TrackNotFoundError);
  });

  it('marks the resulting session dirty and updates updatedAt', () => {
    const result = addFirstRegion();

    expect(result.dirty).toBe(true);
    expect(result.updatedAt).toBe(NEXT_NOW);
  });

  it('preserves order when adding multiple regions on the same track', () => {
    const afterFirst = addFirstRegion();
    const afterSecond = addFirstRegion(afterFirst, 'region-2', 2);

    expect(afterSecond.tracksById['track-1'].regionOrder).toEqual([
      'region-1',
      'region-2',
    ]);
  });

  it('does not mutate the input state', () => {
    const session = sessionWithOneTrack();
    const snapshotBefore = JSON.parse(JSON.stringify(session));

    addFirstRegion(session);

    expect(session).toEqual(snapshotBefore);
  });
});

function sessionWithOneRegion() {
  return addRegion(sessionWithOneTrack(), {
    trackId: 'track-1',
    regionId: 'region-1',
    assetId: 'asset-1',
    startTime: 0,
    duration: 2,
    offset: 0,
    now: NEXT_NOW,
  });
}

describe('moveRegion', () => {
  it('updates the startTime on the target region', () => {
    const session = sessionWithOneRegion();

    const result = moveRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      startTime: 5,
      now: NEXT_NOW,
    });

    expect(result.tracksById['track-1'].regionsById['region-1'].startTime).toBe(
      5
    );
  });

  it('marks dirty and updates updatedAt', () => {
    const session = sessionWithOneRegion();

    const result = moveRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      startTime: 5,
      now: NEXT_NOW,
    });

    expect(result.dirty).toBe(true);
    expect(result.updatedAt).toBe(NEXT_NOW);
  });

  it('throws RegionNotFoundError when the region does not exist', () => {
    const session = sessionWithOneRegion();

    expect(() =>
      moveRegion(session, {
        trackId: 'track-1',
        regionId: 'missing-region',
        startTime: 5,
        now: NEXT_NOW,
      })
    ).toThrow(RegionNotFoundError);
  });

  it('throws TrackNotFoundError when the track does not exist', () => {
    const session = sessionWithOneRegion();

    expect(() =>
      moveRegion(session, {
        trackId: 'missing-track',
        regionId: 'region-1',
        startTime: 5,
        now: NEXT_NOW,
      })
    ).toThrow(TrackNotFoundError);
  });
});

describe('resizeRegion', () => {
  it('updates the duration on the target region', () => {
    const session = sessionWithOneRegion();

    const result = resizeRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      duration: 3,
      now: NEXT_NOW,
    });

    expect(result.tracksById['track-1'].regionsById['region-1'].duration).toBe(
      3
    );
  });

  it('rejects a non-positive duration', () => {
    const session = sessionWithOneRegion();

    expect(() =>
      resizeRegion(session, {
        trackId: 'track-1',
        regionId: 'region-1',
        duration: 0,
        now: NEXT_NOW,
      })
    ).toThrow(/duration/);
  });

  it('throws RegionNotFoundError when the region does not exist', () => {
    const session = sessionWithOneRegion();

    expect(() =>
      resizeRegion(session, {
        trackId: 'track-1',
        regionId: 'missing-region',
        duration: 3,
        now: NEXT_NOW,
      })
    ).toThrow(RegionNotFoundError);
  });
});

describe('removeRegion', () => {
  it('removes the regionId from the track regionOrder', () => {
    const session = sessionWithOneRegion();

    const result = removeRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      now: NEXT_NOW,
    });

    expect(result.tracksById['track-1'].regionOrder).toEqual([]);
  });

  it('removes the entry from regionsById', () => {
    const session = sessionWithOneRegion();

    const result = removeRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      now: NEXT_NOW,
    });

    expect(
      result.tracksById['track-1'].regionsById['region-1']
    ).toBeUndefined();
  });

  it('throws RegionNotFoundError when the region does not exist', () => {
    const session = sessionWithOneRegion();

    expect(() =>
      removeRegion(session, {
        trackId: 'track-1',
        regionId: 'missing',
        now: NEXT_NOW,
      })
    ).toThrow(RegionNotFoundError);
  });

  it('marks dirty and updates updatedAt', () => {
    const session = sessionWithOneRegion();

    const result = removeRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      now: NEXT_NOW,
    });

    expect(result.dirty).toBe(true);
    expect(result.updatedAt).toBe(NEXT_NOW);
  });
});

describe('splitRegion', () => {
  function sessionWithSplittable() {
    const base = addRegion(sessionWithOneTrack(), {
      trackId: 'track-1',
      regionId: 'region-1',
      assetId: 'asset-1',
      startTime: 2,
      duration: 4,
      offset: 1,
      now: NEXT_NOW,
    });
    return base;
  }

  function splitAtThree(session = sessionWithSplittable()) {
    return splitRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      splitTime: 3,
      newRegionId: 'region-1-right',
      now: NEXT_NOW,
    });
  }

  it('keeps the left region with the same id and shortened duration', () => {
    const result = splitAtThree();

    expect(result.tracksById['track-1'].regionsById['region-1']).toEqual({
      id: 'region-1',
      assetId: 'asset-1',
      startTime: 2,
      duration: 1,
      offset: 1,
    });
  });

  it('creates the right region with the new id and adjusted offset', () => {
    const result = splitAtThree();

    expect(
      result.tracksById['track-1'].regionsById['region-1-right']
    ).toEqual({
      id: 'region-1-right',
      assetId: 'asset-1',
      startTime: 3,
      duration: 3,
      offset: 2,
    });
  });

  it('inserts the right region immediately after the left region in regionOrder', () => {
    const session = addRegion(sessionWithSplittable(), {
      trackId: 'track-1',
      regionId: 'region-tail',
      assetId: 'asset-2',
      startTime: 10,
      duration: 2,
      offset: 0,
      now: NEXT_NOW,
    });

    const result = splitRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      splitTime: 3,
      newRegionId: 'region-1-right',
      now: NEXT_NOW,
    });

    expect(result.tracksById['track-1'].regionOrder).toEqual([
      'region-1',
      'region-1-right',
      'region-tail',
    ]);
  });

  it('rejects a split at or before the region start', () => {
    const session = sessionWithSplittable();

    expect(() =>
      splitRegion(session, {
        trackId: 'track-1',
        regionId: 'region-1',
        splitTime: 2,
        newRegionId: 'region-1-right',
        now: NEXT_NOW,
      })
    ).toThrow(/split/i);
  });

  it('rejects a split at or after the region end', () => {
    const session = sessionWithSplittable();

    expect(() =>
      splitRegion(session, {
        trackId: 'track-1',
        regionId: 'region-1',
        splitTime: 6,
        newRegionId: 'region-1-right',
        now: NEXT_NOW,
      })
    ).toThrow(/split/i);
  });

  it('throws RegionNotFoundError when the region does not exist', () => {
    const session = sessionWithSplittable();

    expect(() =>
      splitRegion(session, {
        trackId: 'track-1',
        regionId: 'missing',
        splitTime: 3,
        newRegionId: 'region-1-right',
        now: NEXT_NOW,
      })
    ).toThrow(RegionNotFoundError);
  });

  it('marks the resulting session dirty and updates updatedAt', () => {
    const result = splitAtThree();

    expect(result.dirty).toBe(true);
    expect(result.updatedAt).toBe(NEXT_NOW);
  });
});

describe('setPlaying', () => {
  it('updates playback.playing', () => {
    const session = freshSession();

    const result = setPlaying(session, { playing: true });

    expect(result.playback.playing).toBe(true);
  });

  it('does NOT mark the session dirty', () => {
    const session = freshSession();

    const result = setPlaying(session, { playing: true });

    expect(result.dirty).toBe(false);
  });

  it('does NOT change updatedAt', () => {
    const session = freshSession();

    const result = setPlaying(session, { playing: true });

    expect(result.updatedAt).toBe(session.updatedAt);
  });
});

describe('setPosition', () => {
  it('updates playback.positionSeconds', () => {
    const session = freshSession();

    const result = setPosition(session, { positionSeconds: 3.5 });

    expect(result.playback.positionSeconds).toBe(3.5);
  });

  it('does NOT mark the session dirty', () => {
    const session = freshSession();

    const result = setPosition(session, { positionSeconds: 3.5 });

    expect(result.dirty).toBe(false);
  });
});

describe('setBpm', () => {
  it('updates playback.bpm', () => {
    const session = freshSession();

    const result = setBpm(session, { bpm: 140, now: NEXT_NOW });

    expect(result.playback.bpm).toBe(140);
  });

  it('marks dirty and updates updatedAt', () => {
    const session = freshSession();

    const result = setBpm(session, { bpm: 140, now: NEXT_NOW });

    expect(result.dirty).toBe(true);
    expect(result.updatedAt).toBe(NEXT_NOW);
  });

  it('rejects a non-positive bpm', () => {
    const session = freshSession();

    expect(() => setBpm(session, { bpm: 0, now: NEXT_NOW })).toThrow(/bpm/i);
    expect(() => setBpm(session, { bpm: -10, now: NEXT_NOW })).toThrow(/bpm/i);
  });
});

describe('setMasterVolume', () => {
  it('updates playback.masterVolume', () => {
    const session = freshSession();

    const result = setMasterVolume(session, { volume: 0.5, now: NEXT_NOW });

    expect(result.playback.masterVolume).toBe(0.5);
  });

  it('marks dirty and updates updatedAt', () => {
    const session = freshSession();

    const result = setMasterVolume(session, { volume: 0.5, now: NEXT_NOW });

    expect(result.dirty).toBe(true);
    expect(result.updatedAt).toBe(NEXT_NOW);
  });

  it('rejects a volume outside [0, 1]', () => {
    const session = freshSession();

    expect(() =>
      setMasterVolume(session, { volume: -0.1, now: NEXT_NOW })
    ).toThrow(/volume/i);
    expect(() =>
      setMasterVolume(session, { volume: 1.5, now: NEXT_NOW })
    ).toThrow(/volume/i);
  });
});

describe('setLoop', () => {
  it('updates playback.loop', () => {
    const session = freshSession();

    const result = setLoop(session, {
      start: 1,
      end: 5,
      enabled: true,
      now: NEXT_NOW,
    });

    expect(result.playback.loop).toEqual({
      start: 1,
      end: 5,
      enabled: true,
    });
  });

  it('marks dirty and updates updatedAt', () => {
    const session = freshSession();

    const result = setLoop(session, {
      start: 1,
      end: 5,
      enabled: true,
      now: NEXT_NOW,
    });

    expect(result.dirty).toBe(true);
    expect(result.updatedAt).toBe(NEXT_NOW);
  });

  it('rejects when enabled and end <= start', () => {
    const session = freshSession();

    expect(() =>
      setLoop(session, { start: 4, end: 4, enabled: true, now: NEXT_NOW })
    ).toThrow(/loop/i);
    expect(() =>
      setLoop(session, { start: 5, end: 2, enabled: true, now: NEXT_NOW })
    ).toThrow(/loop/i);
  });

  it('allows end <= start when not enabled', () => {
    const session = freshSession();

    expect(() =>
      setLoop(session, { start: 5, end: 2, enabled: false, now: NEXT_NOW })
    ).not.toThrow();
  });
});

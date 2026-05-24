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


function freshSession() {
  return createEmptySession({ id: 'session-1' });
}

describe('addTrack', () => {
  it('appends the new track id to trackOrder', () => {
    const session = freshSession();

    const result = addTrack(session, {
      trackId: 'track-1',
      name: 'Drums',
    });

    expect(result.trackOrder).toEqual(['track-1']);
  });

  it('creates a tracksById entry with default mixer values and no regions', () => {
    const session = freshSession();

    const result = addTrack(session, {
      trackId: 'track-1',
      name: 'Drums',
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

    addTrack(session, { trackId: 'track-1', name: 'Drums' });

    expect(session).toEqual(snapshotBefore);
  });



  it('preserves order when adding multiple tracks', () => {
    const session = freshSession();

    const afterFirst = addTrack(session, {
      trackId: 'track-1',
      name: 'A',
    });
    const afterSecond = addTrack(afterFirst, {
      trackId: 'track-2',
      name: 'B',
    });

    expect(afterSecond.trackOrder).toEqual(['track-1', 'track-2']);
  });
});

describe('removeTrack', () => {
  function sessionWithTwoTracks() {
    const base = createEmptySession({
      id: 'session-1',
    });
    const afterFirst = addTrack(base, {
      trackId: 'track-1',
      name: 'A',
    });
    return addTrack(afterFirst, {
      trackId: 'track-2',
      name: 'B',
    });
  }

  it('removes the trackId from trackOrder', () => {
    const session = sessionWithTwoTracks();

    const result = removeTrack(session, {
      trackId: 'track-1',
    });

    expect(result.trackOrder).toEqual(['track-2']);
  });

  it('removes the track entry from tracksById', () => {
    const session = sessionWithTwoTracks();

    const result = removeTrack(session, {
      trackId: 'track-1',
    });

    expect(result.tracksById['track-1']).toBeUndefined();
    expect(result.tracksById['track-2']).toBeDefined();
  });

  it('throws TrackNotFoundError when the track does not exist', () => {
    const session = sessionWithTwoTracks();

    expect(() =>
      removeTrack(session, { trackId: 'missing-track' })
    ).toThrow(TrackNotFoundError);
  });



  it('does not mutate the input state', () => {
    const session = sessionWithTwoTracks();
    const snapshotBefore = JSON.parse(JSON.stringify(session));

    removeTrack(session, { trackId: 'track-1' });

    expect(session).toEqual(snapshotBefore);
  });
});

function sessionWithOneTrack() {
  const base = createEmptySession({
    id: 'session-1',
  });
  return addTrack(base, {
    trackId: 'track-1',
    name: 'A',
  });
}

describe('setTrackVolume', () => {
  it('updates the volume on the target track', () => {
    const session = sessionWithOneTrack();

    const result = setTrackVolume(session, {
      trackId: 'track-1',
      volume: 0.5,
    });

    expect(result.tracksById['track-1'].volume).toBe(0.5);
  });


  it('throws TrackNotFoundError when the track does not exist', () => {
    const session = sessionWithOneTrack();

    expect(() =>
      setTrackVolume(session, {
        trackId: 'missing',
        volume: 0.5,
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
    });

    expect(result.tracksById['track-1'].muted).toBe(true);
  });


  it('throws TrackNotFoundError on missing track', () => {
    const session = sessionWithOneTrack();

    expect(() =>
      setTrackMute(session, {
        trackId: 'missing',
        muted: true,
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
    });

    expect(result.tracksById['track-1'].soloed).toBe(true);
  });

  it('throws TrackNotFoundError on missing track', () => {
    const session = sessionWithOneTrack();

    expect(() =>
      setTrackSolo(session, {
        trackId: 'missing',
        soloed: true,
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
    });

    expect(result.tracksById['track-1'].pan).toBe(-0.5);
  });

  it('throws TrackNotFoundError on missing track', () => {
    const session = sessionWithOneTrack();

    expect(() =>
      setTrackPan(session, {
        trackId: 'missing',
        pan: 0,
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
      })
    ).toThrow(TrackNotFoundError);
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
  });
}

describe('moveRegion', () => {
  it('updates the startTime on the target region', () => {
    const session = sessionWithOneRegion();

    const result = moveRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      startTime: 5,
    });

    expect(result.tracksById['track-1'].regionsById['region-1'].startTime).toBe(
      5
    );
  });


  it('throws RegionNotFoundError when the region does not exist', () => {
    const session = sessionWithOneRegion();

    expect(() =>
      moveRegion(session, {
        trackId: 'track-1',
        regionId: 'missing-region',
        startTime: 5,
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
    });

    expect(result.tracksById['track-1'].regionOrder).toEqual([]);
  });

  it('removes the entry from regionsById', () => {
    const session = sessionWithOneRegion();

    const result = removeRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
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
      })
    ).toThrow(RegionNotFoundError);
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
    });
    return base;
  }

  function splitAtThree(session = sessionWithSplittable()) {
    return splitRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      splitTime: 3,
      newRegionId: 'region-1-right',
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
    });

    const result = splitRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      splitTime: 3,
      newRegionId: 'region-1-right',
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
      })
    ).toThrow(RegionNotFoundError);
  });

});

describe('setPlaying', () => {
  it('updates playback.playing', () => {
    const session = freshSession();

    const result = setPlaying(session, { playing: true });

    expect(result.playback.playing).toBe(true);
  });


});

describe('setPosition', () => {
  it('updates playback.positionSeconds', () => {
    const session = freshSession();

    const result = setPosition(session, { positionSeconds: 3.5 });

    expect(result.playback.positionSeconds).toBe(3.5);
  });

});

describe('setBpm', () => {
  it('updates playback.bpm', () => {
    const session = freshSession();

    const result = setBpm(session, { bpm: 140 });

    expect(result.playback.bpm).toBe(140);
  });


  it('rejects a non-positive bpm', () => {
    const session = freshSession();

    expect(() => setBpm(session, { bpm: 0 })).toThrow(/bpm/i);
    expect(() => setBpm(session, { bpm: -10 })).toThrow(/bpm/i);
  });
});

describe('setMasterVolume', () => {
  it('updates playback.masterVolume', () => {
    const session = freshSession();

    const result = setMasterVolume(session, { volume: 0.5 });

    expect(result.playback.masterVolume).toBe(0.5);
  });


  it('rejects a volume outside [0, 1]', () => {
    const session = freshSession();

    expect(() =>
      setMasterVolume(session, { volume: -0.1 })
    ).toThrow(/volume/i);
    expect(() =>
      setMasterVolume(session, { volume: 1.5 })
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
    });

    expect(result.playback.loop).toEqual({
      start: 1,
      end: 5,
      enabled: true,
    });
  });


  it('rejects when enabled and end <= start', () => {
    const session = freshSession();

    expect(() =>
      setLoop(session, { start: 4, end: 4, enabled: true })
    ).toThrow(/loop/i);
    expect(() =>
      setLoop(session, { start: 5, end: 2, enabled: true })
    ).toThrow(/loop/i);
  });

  it('allows end <= start when not enabled', () => {
    const session = freshSession();

    expect(() =>
      setLoop(session, { start: 5, end: 2, enabled: false })
    ).not.toThrow();
  });
});

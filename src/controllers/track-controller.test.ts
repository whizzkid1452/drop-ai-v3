import { beforeEach, describe, expect, it } from 'vitest';
import { TrackController } from './track-controller';
import type { IdGenerator } from './id-generator';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import {
  createSessionStore,
  type ISessionStore,
} from '@/session/session-store';
import { createEmptySession } from '@/session/session-state';
import { createCallRecorder } from '@/testing/call-recorder';
import {
  RegionNotFoundError,
  TrackNotFoundError,
} from '@/session/session-errors';

function fixedIdGenerator(): IdGenerator {
  let trackCounter = 0;
  let assetCounter = 0;
  let regionCounter = 0;
  return {
    next(prefix) {
      if (prefix === 'track') {
        trackCounter += 1;
        return `track-${trackCounter}`;
      }
      if (prefix === 'asset') {
        assetCounter += 1;
        return `asset-${assetCounter}`;
      }
      if (prefix === 'region') {
        regionCounter += 1;
        return `region-${regionCounter}`;
      }
      return `${prefix ?? 'id'}-x`;
    },
  };
}

interface Harness {
  store: ISessionStore;
  audio: FakeAudioEngine;
  recorder: ReturnType<typeof createCallRecorder>;
  controller: TrackController;
}

function setup(): Harness {
  const store = createSessionStore({
    initialSession: createEmptySession({ id: 'session-1' }),
  });
  const recorder = createCallRecorder();
  const audio = new FakeAudioEngine({
    recorder,
    assetDurations: { 'asset-1': 4, 'asset-2': 3 },
  });
  const controller = new TrackController({
    sessionStore: store,
    audioEngine: audio,
    idGenerator: fixedIdGenerator(),
  });
  return { store, audio, recorder, controller };
}

describe('TrackController.addTrack', () => {
  it('returns { id } using the injected id generator', async () => {
    const { controller } = setup();

    const result = await controller.addTrack();

    expect(result).toEqual({ id: 'track-1' });
  });

  it('updates the session store with the new track', async () => {
    const { store, controller } = setup();

    await controller.addTrack();

    expect(store.getState().trackOrder).toEqual(['track-1']);
    expect(store.getState().tracksById['track-1']).toBeDefined();
  });

  it('calls audio.createTrack with the new id', async () => {
    const { recorder, controller } = setup();

    await controller.addTrack();

    expect(recorder.getCalls('createTrack').map((call) => call.args)).toEqual([
      ['track-1'],
    ]);
  });

  it('does not update the session when audio track creation fails', async () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      createTrack(): void {
        throw new Error('createTrack failed');
      }
    })();
    const controller = new TrackController({
      sessionStore: store,
      audioEngine: audio,
      idGenerator: fixedIdGenerator(),
    });

    await expect(controller.addTrack()).rejects.toThrow('createTrack failed');
    expect(store.getState().trackOrder).toEqual([]);
    expect(store.getState().tracksById).toEqual({});
  });
});

describe('TrackController.removeTrack', () => {
  it('removes the track from the session and audio', async () => {
    const harness = setup();
    await harness.controller.addTrack();

    harness.controller.removeTrack('track-1');

    expect(harness.store.getState().trackOrder).toEqual([]);
    expect(
      harness.recorder.getCalls('removeTrack').map((call) => call.args)
    ).toEqual([['track-1']]);
  });

  it('throws TrackNotFoundError when the track does not exist', () => {
    const { controller } = setup();

    expect(() => controller.removeTrack('missing')).toThrow(TrackNotFoundError);
  });

  it('does not remove from the session when audio removal fails', async () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      removeTrack(): void {
        throw new Error('removeTrack failed');
      }
    })();
    const controller = new TrackController({
      sessionStore: store,
      audioEngine: audio,
      idGenerator: fixedIdGenerator(),
    });
    await controller.addTrack();

    expect(() => controller.removeTrack('track-1')).toThrow(
      'removeTrack failed'
    );
    expect(store.getState().trackOrder).toEqual(['track-1']);
    expect(store.getState().tracksById['track-1']).toBeDefined();
  });
});

describe('TrackController mixer setters', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = setup();
    await harness.controller.addTrack();
    harness.recorder.reset();
  });

  it('setTrackVolume updates session and audio', () => {
    harness.controller.setTrackVolume('track-1', 0.5);

    expect(harness.store.getState().tracksById['track-1'].volume).toBe(0.5);
    expect(harness.recorder.getCalls('setTrackVolume')[0].args).toEqual([
      'track-1',
      0.5,
    ]);
  });

  it('setTrackMute updates session and audio', () => {
    harness.controller.setTrackMute('track-1', true);

    expect(harness.store.getState().tracksById['track-1'].muted).toBe(true);
    expect(harness.recorder.getCalls('setTrackMute')[0].args).toEqual([
      'track-1',
      true,
    ]);
  });

  it('setTrackSolo updates session and audio', () => {
    harness.controller.setTrackSolo('track-1', true);

    expect(harness.store.getState().tracksById['track-1'].soloed).toBe(true);
    expect(harness.recorder.getCalls('setTrackSolo')[0].args).toEqual([
      'track-1',
      true,
    ]);
  });

  it('setTrackPan updates session and audio', () => {
    harness.controller.setTrackPan('track-1', -0.3);

    expect(harness.store.getState().tracksById['track-1'].pan).toBe(-0.3);
    expect(harness.recorder.getCalls('setTrackPan')[0].args).toEqual([
      'track-1',
      -0.3,
    ]);
  });

  it('does not update the session when an audio mixer change fails', async () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      setTrackVolume(): void {
        throw new Error('setTrackVolume failed');
      }
    })();
    const controller = new TrackController({
      sessionStore: store,
      audioEngine: audio,
      idGenerator: fixedIdGenerator(),
    });
    await controller.addTrack();
    const volumeBefore = store.getState().tracksById['track-1'].volume;

    expect(() => controller.setTrackVolume('track-1', 0.5)).toThrow(
      'setTrackVolume failed'
    );
    expect(store.getState().tracksById['track-1'].volume).toBe(volumeBefore);
  });
});

describe('TrackController.addRegionFromAsset', () => {
  it('queries asset duration, adds the audio region, and updates session', async () => {
    const harness = setup();
    await harness.controller.addTrack();
    harness.recorder.reset();

    const result = await harness.controller.addRegionFromAsset({
      trackId: 'track-1',
      assetId: 'asset-1',
      startTime: 2,
    });

    expect(result).toEqual({ id: 'region-1' });
    const region =
      harness.store.getState().tracksById['track-1'].regionsById['region-1'];
    expect(region).toEqual({
      id: 'region-1',
      assetId: 'asset-1',
      startTime: 2,
      duration: 4,
      offset: 0,
    });

    const methodOrder = harness.recorder.calls.map((call) => call.method);
    const durationIndex = methodOrder.indexOf('getAssetDuration');
    const addRegionIndex = methodOrder.indexOf('addRegion');
    expect(durationIndex).toBeGreaterThanOrEqual(0);
    expect(addRegionIndex).toBeGreaterThan(durationIndex);
  });

  it('does not update the session when audio region creation fails', async () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      addRegion(): void {
        throw new Error('addRegion failed');
      }
    })({ assetDurations: { 'asset-1': 4 } });
    const controller = new TrackController({
      sessionStore: store,
      audioEngine: audio,
      idGenerator: fixedIdGenerator(),
    });
    await controller.addTrack();

    await expect(
      controller.addRegionFromAsset({
        trackId: 'track-1',
        assetId: 'asset-1',
        startTime: 0,
      })
    ).rejects.toThrow('addRegion failed');

    expect(store.getState().tracksById['track-1'].regionOrder).toEqual([]);
    expect(store.getState().tracksById['track-1'].regionsById).toEqual({});
  });

  it('throws TrackNotFoundError when the track does not exist', async () => {
    const { controller } = setup();

    await expect(
      controller.addRegionFromAsset({
        trackId: 'missing',
        assetId: 'asset-1',
        startTime: 0,
      })
    ).rejects.toThrow(TrackNotFoundError);
  });
});

describe('TrackController.moveRegion / resizeRegion / removeRegion', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = setup();
    await harness.controller.addTrack();
    await harness.controller.addRegionFromAsset({
      trackId: 'track-1',
      assetId: 'asset-1',
      startTime: 0,
    });
    harness.recorder.reset();
  });

  it('moveRegion updates session and audio', () => {
    harness.controller.moveRegion({
      trackId: 'track-1',
      regionId: 'region-1',
      startTime: 5,
    });

    expect(
      harness.store.getState().tracksById['track-1'].regionsById['region-1']
        .startTime
    ).toBe(5);
    expect(harness.recorder.getCalls('moveRegion')[0].args).toEqual([
      'track-1',
      'region-1',
      5,
    ]);
  });

  it('moveRegion leaves session unchanged when audio move fails', async () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      moveRegion(): void {
        throw new Error('moveRegion failed');
      }
    })({ assetDurations: { 'asset-1': 4 } });
    const controller = new TrackController({
      sessionStore: store,
      audioEngine: audio,
      idGenerator: fixedIdGenerator(),
    });
    await controller.addTrack();
    await controller.addRegionFromAsset({
      trackId: 'track-1',
      assetId: 'asset-1',
      startTime: 0,
    });

    expect(() =>
      controller.moveRegion({
        trackId: 'track-1',
        regionId: 'region-1',
        startTime: 5,
      })
    ).toThrow('moveRegion failed');
    expect(
      store.getState().tracksById['track-1'].regionsById['region-1'].startTime
    ).toBe(0);
  });

  it('resizeRegion updates session and audio', () => {
    harness.controller.resizeRegion({
      trackId: 'track-1',
      regionId: 'region-1',
      duration: 2,
    });

    expect(
      harness.store.getState().tracksById['track-1'].regionsById['region-1']
        .duration
    ).toBe(2);
    expect(harness.recorder.getCalls('resizeRegion')[0].args).toEqual([
      'track-1',
      'region-1',
      2,
    ]);
  });

  it('resizeRegion leaves session unchanged when audio resize fails', async () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      resizeRegion(): void {
        throw new Error('resizeRegion failed');
      }
    })({ assetDurations: { 'asset-1': 4 } });
    const controller = new TrackController({
      sessionStore: store,
      audioEngine: audio,
      idGenerator: fixedIdGenerator(),
    });
    await controller.addTrack();
    await controller.addRegionFromAsset({
      trackId: 'track-1',
      assetId: 'asset-1',
      startTime: 0,
    });

    expect(() =>
      controller.resizeRegion({
        trackId: 'track-1',
        regionId: 'region-1',
        duration: 2,
      })
    ).toThrow('resizeRegion failed');
    expect(
      store.getState().tracksById['track-1'].regionsById['region-1'].duration
    ).toBe(4);
  });

  it('removeRegion updates session and audio', () => {
    harness.controller.removeRegion('track-1', 'region-1');

    expect(harness.store.getState().tracksById['track-1'].regionOrder).toEqual(
      []
    );
    expect(harness.recorder.getCalls('removeRegion')[0].args).toEqual([
      'track-1',
      'region-1',
    ]);
  });

  it('removeRegion leaves session unchanged when audio remove fails', async () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      removeRegion(): void {
        throw new Error('removeRegion failed');
      }
    })({ assetDurations: { 'asset-1': 4 } });
    const controller = new TrackController({
      sessionStore: store,
      audioEngine: audio,
      idGenerator: fixedIdGenerator(),
    });
    await controller.addTrack();
    await controller.addRegionFromAsset({
      trackId: 'track-1',
      assetId: 'asset-1',
      startTime: 0,
    });

    expect(() => controller.removeRegion('track-1', 'region-1')).toThrow(
      'removeRegion failed'
    );
    expect(store.getState().tracksById['track-1'].regionOrder).toEqual([
      'region-1',
    ]);
    expect(
      store.getState().tracksById['track-1'].regionsById['region-1']
    ).toBeDefined();
  });

  it('removeRegion throws RegionNotFoundError when missing', () => {
    expect(() => harness.controller.removeRegion('track-1', 'missing')).toThrow(
      RegionNotFoundError
    );
  });
});

describe('TrackController.splitRegion', () => {
  it('returns { leftId, rightId }, resizes left in audio, and adds right in audio', async () => {
    const harness = setup();
    await harness.controller.addTrack();
    await harness.controller.addRegionFromAsset({
      trackId: 'track-1',
      assetId: 'asset-1',
      startTime: 2,
    });
    harness.recorder.reset();

    const result = harness.controller.splitRegion({
      trackId: 'track-1',
      regionId: 'region-1',
      splitTime: 4,
    });

    expect(result).toEqual({ leftId: 'region-1', rightId: 'region-2' });

    const resizeCalls = harness.recorder.getCalls('resizeRegion');
    expect(resizeCalls.map((c) => c.args)).toEqual([
      ['track-1', 'region-1', 2],
    ]);

    const addRegionCalls = harness.recorder.getCalls('addRegion');
    expect(addRegionCalls).toHaveLength(1);
    expect(addRegionCalls[0].args[0]).toEqual({
      trackId: 'track-1',
      regionId: 'region-2',
      assetId: 'asset-1',
      startTime: 4,
      duration: 2,
      offset: 2,
    });
  });

  it('throws RegionNotFoundError when the source region does not exist', async () => {
    const harness = setup();
    await harness.controller.addTrack();

    expect(() =>
      harness.controller.splitRegion({
        trackId: 'track-1',
        regionId: 'missing',
        splitTime: 1,
      })
    ).toThrow(RegionNotFoundError);
  });
});

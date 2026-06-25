import { describe, expect, it } from 'vitest';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { addRegion, addTrack } from '@/session/session-operations';
import {
  createSessionStore,
  type ISessionStore,
} from '@/session/session-store';
import { createEmptySession } from '@/session/session-state';
import { createCallRecorder } from '@/testing/call-recorder';
import { ExportRangeController } from './export-range-controller';

interface Harness {
  controller: ExportRangeController;
  recorder: ReturnType<typeof createCallRecorder>;
  store: ISessionStore;
}

function setup(): Harness {
  const store = createSessionStore({
    initialSession: createEmptySession({ id: 'session-1' }),
  });
  const recorder = createCallRecorder();
  const audioEngine = new FakeAudioEngine({ recorder });
  const controller = new ExportRangeController({
    audioEngine,
    sessionStore: store,
  });

  return { controller, recorder, store };
}

function setupWithRegion(): Harness {
  const harness = setup();
  harness.store.applyOperation((state) =>
    addTrack(state, { trackId: 'track-1', name: 'A' })
  );
  harness.store.applyOperation((state) =>
    addRegion(state, {
      assetId: 'asset-1',
      duration: 4,
      offset: 0,
      regionId: 'region-1',
      startTime: 0,
      trackId: 'track-1',
    })
  );
  return harness;
}

describe('ExportRangeController', () => {
  it('stores export range boundaries in session state', () => {
    const { controller, store } = setup();

    controller.setExportRangeEnd(8);
    controller.setExportRangeStart(2);

    expect(store.getState().exportRange).toMatchObject({
      endSeconds: 8,
      startSeconds: 2,
    });
  });

  it('stores export range fade settings in session state', () => {
    const { controller, store } = setup();

    controller.setExportRangeFadeIn(0.5);
    controller.setExportRangeFadeOut(0.25);

    expect(store.getState().exportRange).toMatchObject({
      fadeInSeconds: 0.5,
      fadeOutSeconds: 0.25,
    });
  });

  it('previews the export range through playback state and audio engine calls', async () => {
    const { controller, recorder, store } = setup();
    controller.setExportRangeEnd(8);
    controller.setExportRangeStart(2);

    await controller.previewExportRange();

    expect(store.getState().playback).toMatchObject({
      loop: { enabled: true, end: 8, start: 2 },
      playing: true,
      positionSeconds: 2,
    });
    expect(recorder.calls.map((call) => call.method)).toEqual([
      'seek',
      'setLoop',
      'play',
    ]);
  });

  it('exports only the current export range', async () => {
    const { controller, recorder } = setupWithRegion();
    controller.setExportRangeEnd(3);
    controller.setExportRangeStart(1);
    controller.setExportRangeFadeIn(0.25);

    const result = await controller.exportRange('clip.wav');

    expect(result.filename).toBe('clip.wav');
    expect(result.blob).toBeInstanceOf(Blob);
    expect(recorder.getCalls('exportSessionRange')[0].args[0]).toMatchObject({
      durationSeconds: 2,
      endSeconds: 3,
      fadeInSeconds: 0.25,
      fadeOutSeconds: 0,
      startSeconds: 1,
    });
  });

  it('uses a range-specific default filename', async () => {
    const { controller } = setupWithRegion();

    const result = await controller.exportRange();

    expect(result.filename).toBe('session-1-range.wav');
  });

  it('rejects a range that does not intersect any region', async () => {
    const { controller } = setupWithRegion();
    controller.setExportRangeEnd(12);
    controller.setExportRangeStart(10);

    await expect(controller.exportRange()).rejects.toThrow(/empty range/i);
  });
});

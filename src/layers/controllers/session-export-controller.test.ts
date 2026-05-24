import { describe, expect, it } from 'vitest';
import { SessionExportController } from './session-export-controller';
import { FakeAudioProvider } from '@/layers/audio/fake-audio-provider';
import {
  createSessionStore,
  type SessionStore,
} from '@/layers/core/session/session-store';
import { createEmptySession } from '@/layers/core/session/session-state';
import { addTrack } from '@/layers/core/session/session-operations';
import { createCallRecorder } from '@/layers/testing/call-recorder';

interface Harness {
  store: SessionStore;
  recorder: ReturnType<typeof createCallRecorder>;
  controller: SessionExportController;
}

function setup(): Harness {
  const store = createSessionStore({
    initialSession: createEmptySession({ id: 'session-1' }),
  });
  const recorder = createCallRecorder();
  const audio = new FakeAudioProvider({ recorder });
  const controller = new SessionExportController({
    sessionStore: store,
    audioProvider: audio,
  });
  return { store, recorder, controller };
}

function setupWithRegion() {
  const h = setup();
  h.store.applyOperation((state) =>
    addTrack(state, { trackId: 'track-1', name: 'A' })
  );
  h.store.applyOperation((state) => ({
    ...state,
    tracksById: {
      ...state.tracksById,
      'track-1': {
        ...state.tracksById['track-1'],
        regionOrder: ['region-1'],
        regionsById: {
          'region-1': {
            id: 'region-1',
            assetId: 'asset-1',
            startTime: 1,
            duration: 2,
            offset: 0,
          },
        },
      },
    },
  }));
  return h;
}

describe('SessionExportController.exportSession', () => {
  it('calls audio.exportSession with the computed session duration', async () => {
    const h = setupWithRegion();

    await h.controller.exportSession();

    const calls = h.recorder.getCalls('exportSession');
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe(3);
    expect(calls[0].args[1]).toBe('session-1');
  });

  it('returns a Blob and a default filename derived from session id', async () => {
    const h = setupWithRegion();

    const result = await h.controller.exportSession();

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.filename).toBe('session-1.wav');
  });

  it('uses the provided filename when supplied', async () => {
    const h = setupWithRegion();

    const result = await h.controller.exportSession('mix.wav');

    expect(result.filename).toBe('mix.wav');
  });

  it('throws when the session has no regions', async () => {
    const h = setup();

    await expect(h.controller.exportSession()).rejects.toThrow(/empty/i);
  });
});

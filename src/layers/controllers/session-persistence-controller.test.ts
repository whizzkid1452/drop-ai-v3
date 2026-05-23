import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionPersistenceController } from './session-persistence-controller';
import { FakeAudioProvider } from '@/layers/audio/fake-audio-provider';
import {
  createSessionStore,
  type SessionStore,
} from '@/layers/core/session/session-store';
import { createEmptySession } from '@/layers/core/session/session-state';
import { addTrack } from '@/layers/core/session/session-operations';
import { MemorySessionStorage } from '@/layers/storage/memory-session-storage';
import { createCallRecorder } from '@/layers/testing/call-recorder';

const NOW = '2026-05-23T00:00:00.000Z';

interface Harness {
  store: SessionStore;
  audio: FakeAudioProvider;
  recorder: ReturnType<typeof createCallRecorder>;
  storage: MemorySessionStorage;
  controller: SessionPersistenceController;
}

function setup(): Harness {
  const store = createSessionStore({
    initialSession: createEmptySession({ id: 'session-1', now: NOW }),
  });
  const recorder = createCallRecorder();
  const audio = new FakeAudioProvider({ recorder });
  const storage = new MemorySessionStorage();
  const controller = new SessionPersistenceController({
    sessionStore: store,
    storage,
    audioProvider: audio,
  });
  return { store, audio, recorder, storage, controller };
}

function makeDirty(store: SessionStore) {
  store.applyOperation(state =>
    addTrack(state, { trackId: 'track-1', name: 'A', now: NOW })
  );
}

describe('SessionPersistenceController.saveSession', () => {
  let h: Harness;
  beforeEach(() => {
    h = setup();
  });

  it('writes the current snapshot to storage', async () => {
    makeDirty(h.store);

    await h.controller.saveSession();

    const loaded = await h.storage.loadLatest();
    expect(loaded?.trackOrder).toEqual(['track-1']);
  });

  it('clears dirty after a successful save', async () => {
    makeDirty(h.store);
    expect(h.store.getState().dirty).toBe(true);

    await h.controller.saveSession();

    expect(h.store.getState().dirty).toBe(false);
  });

  it('keeps dirty and rethrows when storage fails', async () => {
    makeDirty(h.store);
    const failingStorage = {
      loadLatest: vi.fn(),
      save: vi.fn().mockRejectedValue(new Error('disk full')),
      clear: vi.fn(),
    };
    const controller = new SessionPersistenceController({
      sessionStore: h.store,
      storage: failingStorage,
      audioProvider: h.audio,
    });

    await expect(controller.saveSession()).rejects.toThrow(/disk full/);
    expect(h.store.getState().dirty).toBe(true);
  });
});

describe('SessionPersistenceController.restoreSession', () => {
  it('loads snapshot, replaces session, then calls audio.syncSession', async () => {
    const h = setup();
    makeDirty(h.store);
    await h.controller.saveSession();

    const otherStore = createSessionStore({
      initialSession: createEmptySession({ id: 'session-2', now: NOW }),
    });
    const recorder = createCallRecorder();
    const audio = new FakeAudioProvider({ recorder });
    const restoringController = new SessionPersistenceController({
      sessionStore: otherStore,
      storage: h.storage,
      audioProvider: audio,
    });

    await restoringController.restoreSession();

    expect(otherStore.getState().trackOrder).toEqual(['track-1']);
    expect(recorder.getCalls('syncSession')).toHaveLength(1);
  });

  it('is a no-op when storage is empty', async () => {
    const h = setup();
    const before = h.store.getState();

    await h.controller.restoreSession();

    expect(h.store.getState()).toEqual(before);
    expect(h.recorder.getCalls('syncSession')).toHaveLength(0);
  });
});

describe('SessionPersistenceController.exportSession', () => {
  function setupWithRegion() {
    const h = setup();
    h.store.applyOperation(state =>
      addTrack(state, { trackId: 'track-1', name: 'A', now: NOW })
    );
    h.store.applyOperation(state => ({
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

  it('throws when the session has no regions (duration 0)', async () => {
    const h = setup();

    await expect(h.controller.exportSession()).rejects.toThrow(/empty/i);
  });
});

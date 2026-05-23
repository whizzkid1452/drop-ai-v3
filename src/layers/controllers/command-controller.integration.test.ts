import { beforeEach, describe, expect, it } from 'vitest';
import { AppController } from './app-controller';
import { PlaybackController } from './playback-controller';
import { SessionPersistenceController } from './session-persistence-controller';
import { TrackController } from './track-controller';
import type { IdGenerator } from './id-generator';
import { FakeAudioProvider } from '@/layers/audio/fake-audio-provider';
import { MemorySessionStorage } from '@/layers/storage/memory-session-storage';
import {
  createSessionStore,
  type SessionStore,
} from '@/layers/core/session/session-store';
import { createEmptySession } from '@/layers/core/session/session-state';
import { createCallRecorder } from '@/layers/testing/call-recorder';

const NOW = '2026-05-23T00:00:00.000Z';

function fixedIdGenerator(): IdGenerator {
  const counters: Record<string, number> = {};
  return {
    next(prefix = 'id') {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
  };
}

interface Harness {
  app: AppController;
  store: SessionStore;
  storage: MemorySessionStorage;
  audio: FakeAudioProvider;
}

function setup(): Harness {
  const store = createSessionStore({
    initialSession: createEmptySession({ id: 'session-1', now: NOW }),
  });
  const recorder = createCallRecorder();
  const audio = new FakeAudioProvider({
    recorder,
    assetDurations: { 'asset-1': 4 },
  });
  const storage = new MemorySessionStorage();
  const idGenerator = fixedIdGenerator();
  const now = () => NOW;

  const track = new TrackController({
    sessionStore: store,
    audioProvider: audio,
    idGenerator,
    now,
  });
  const playback = new PlaybackController({
    sessionStore: store,
    audioProvider: audio,
    now,
  });
  const persistence = new SessionPersistenceController({
    sessionStore: store,
    storage,
    audioProvider: audio,
  });

  const app = new AppController({
    playbackController: playback,
    trackController: track,
    sessionPersistenceController: persistence,
  });

  return { app, store, storage, audio };
}

describe('command-controller integration: result shapes', () => {
  let h: Harness;
  beforeEach(() => {
    h = setup();
  });

  it('track.add returns data { id }', async () => {
    const result = await h.app.executeCommand({ type: 'track.add' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ id: 'track-1' });
    }
  });

  it('region.split returns data { leftId, rightId }', async () => {
    await h.app.executeCommand({ type: 'track.add' });
    await h.app.executeCommand({
      type: 'region.add',
      payload: { trackId: 'track-1', assetId: 'asset-1', startTime: 2 },
    });

    const result = await h.app.executeCommand({
      type: 'region.split',
      payload: {
        trackId: 'track-1',
        regionId: 'region-1',
        splitTime: 4,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        leftId: 'region-1',
        rightId: 'region-2',
      });
    }
  });

  it('track.volume.set returns ok without data', async () => {
    await h.app.executeCommand({ type: 'track.add' });
    const result = await h.app.executeCommand({
      type: 'track.volume.set',
      payload: { trackId: 'track-1', volume: 0.5 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeUndefined();
    }
  });
});

describe('command-controller integration: dirty tracking', () => {
  let h: Harness;
  beforeEach(() => {
    h = setup();
  });

  it('track.add marks the session dirty', async () => {
    await h.app.executeCommand({ type: 'track.add' });
    expect(h.store.getState().dirty).toBe(true);
  });

  it('session.save clears dirty', async () => {
    await h.app.executeCommand({ type: 'track.add' });
    expect(h.store.getState().dirty).toBe(true);

    await h.app.executeCommand({ type: 'session.save' });
    expect(h.store.getState().dirty).toBe(false);
  });

  it('playback.play does not mark the session dirty', async () => {
    await h.app.executeCommand({ type: 'playback.play' });
    expect(h.store.getState().dirty).toBe(false);
  });
});

describe('command-controller integration: validation vs execution failure', () => {
  let h: Harness;
  beforeEach(() => {
    h = setup();
  });

  it('returns COMMAND_VALIDATION_FAILED when payload is invalid (volume out of range)', async () => {
    await h.app.executeCommand({ type: 'track.add' });
    const result = await h.app.executeCommand({
      type: 'track.volume.set',
      payload: { trackId: 'track-1', volume: 2 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMMAND_VALIDATION_FAILED');
    }
  });

  it('returns COMMAND_EXECUTION_FAILED when a known command targets a missing track', async () => {
    const result = await h.app.executeCommand({
      type: 'track.remove',
      payload: { trackId: 'missing-track' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMMAND_EXECUTION_FAILED');
      expect(result.error.message).toMatch(/track/i);
    }
  });
});

describe('command-controller integration: end-to-end save/restore', () => {
  it('persists tracks and regions through save and restores them into a fresh app', async () => {
    const h = setup();
    await h.app.executeCommand({ type: 'track.add' });
    await h.app.executeCommand({
      type: 'region.add',
      payload: { trackId: 'track-1', assetId: 'asset-1', startTime: 0 },
    });
    await h.app.executeCommand({ type: 'session.save' });

    const fresh = setup();
    // share the storage by swapping in the original storage's snapshot
    const snapshot = await h.storage.loadLatest();
    if (!snapshot) throw new Error('expected saved snapshot');
    await fresh.storage.save(snapshot);

    await fresh.app.executeCommand({ type: 'session.restore' });

    expect(fresh.store.getState().trackOrder).toEqual(['track-1']);
    expect(
      fresh.store.getState().tracksById['track-1'].regionOrder
    ).toEqual(['region-1']);
  });
});

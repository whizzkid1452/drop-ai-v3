import { describe, expect, it } from 'vitest';
import { runCli } from './cli-runner';
import { createApp } from '@/layers/composition/create-app';
import { FakeAudioProvider } from '@/layers/audio/fake-audio-provider';
import { MemorySessionStorage } from '@/layers/storage/memory-session-storage';

const NOW = '2026-05-23T00:00:00.000Z';

function fixedIdGenerator() {
  const counters: Record<string, number> = {};
  return {
    next(prefix = 'id') {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
  };
}

function setup() {
  return createApp({
    audioProvider: new FakeAudioProvider({
      assetDurations: { 'asset-1': 4 },
    }),
    storage: new MemorySessionStorage(),
    idGenerator: fixedIdGenerator(),
    now: () => NOW,
    sessionId: 'session-1',
  });
}

describe('runCli', () => {
  it('"track add" creates a track', async () => {
    const app = setup();

    const result = await runCli('track add', { appController: app.controller });

    expect(result.ok).toBe(true);
    expect(app.sessionStore.getState().trackOrder).toEqual(['track-1']);
  });

  it('"volume track-1 0.5" updates the track volume', async () => {
    const app = setup();
    await runCli('track add', { appController: app.controller });

    const result = await runCli('volume track-1 0.5', {
      appController: app.controller,
    });

    expect(result.ok).toBe(true);
    expect(app.sessionStore.getState().tracksById['track-1'].volume).toBe(0.5);
  });

  it('"session save" persists snapshot to storage', async () => {
    const app = setup();
    await runCli('track add', { appController: app.controller });

    const result = await runCli('session save', {
      appController: app.controller,
    });

    expect(result.ok).toBe(true);
    const loaded = await app.storage.loadLatest();
    expect(loaded?.trackOrder).toEqual(['track-1']);
  });

  it('"session restore" replaces store with loaded snapshot', async () => {
    const app = setup();
    await runCli('track add', { appController: app.controller });
    await runCli('session save', { appController: app.controller });

    const fresh = setup();
    const snapshot = await app.storage.loadLatest();
    if (!snapshot) throw new Error('expected snapshot');
    await fresh.storage.save(snapshot);

    const result = await runCli('session restore', {
      appController: fresh.controller,
    });

    expect(result.ok).toBe(true);
    expect(fresh.sessionStore.getState().trackOrder).toEqual(['track-1']);
  });

  it('does not call any controller when the cli input is invalid', async () => {
    const app = setup();

    const result = await runCli('not-a-real-command', {
      appController: app.controller,
    });

    expect(result.ok).toBe(false);
    expect(app.sessionStore.getState().trackOrder).toEqual([]);
  });
});

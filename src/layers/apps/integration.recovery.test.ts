import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '@/layers/composition/create-app';
import { FakeAudioProvider } from '@/layers/audio/fake-audio-provider';
import { IndexedDbSessionStorage } from '@/layers/storage/indexeddb/indexed-db-session-storage';

const NOW = '2026-05-23T00:00:00.000Z';
const DEBOUNCE_MS = 50;
const DB_NAME = 'drop-ai-v3-test-recovery';

function fixedIdGenerator() {
  const counters: Record<string, number> = {};
  return {
    next(prefix = 'id') {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
});

afterEach(async () => {
  vi.useRealTimers();
  const cleaner = new IndexedDbSessionStorage({ dbName: DB_NAME });
  await cleaner.clear();
});

describe('IndexedDB reload recovery', () => {
  it('autosaves edits in app 1 and restores them into app 2 on the same db', async () => {
    const audioForApp1 = new FakeAudioProvider({
      assetDurations: { 'asset-1': 4 },
    });
    const app1 = createApp({
      audioProvider: audioForApp1,
      idGenerator: fixedIdGenerator(),
      now: () => NOW,
      sessionId: 'session-1',
      indexedDbName: DB_NAME,
      autosave: { debounceMs: DEBOUNCE_MS },
    });

    await app1.controller.executeCommand({ type: 'track.add' });
    await app1.controller.executeCommand({
      type: 'region.add',
      payload: { trackId: 'track-1', assetId: 'asset-1', startTime: 0 },
    });

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    await vi.runAllTimersAsync();

    app1.dispose();

    const audioForApp2 = new FakeAudioProvider({
      assetDurations: { 'asset-1': 4 },
    });
    const app2 = createApp({
      audioProvider: audioForApp2,
      idGenerator: fixedIdGenerator(),
      now: () => NOW,
      sessionId: 'session-2',
      indexedDbName: DB_NAME,
    });

    const restoreResult = await app2.controller.executeCommand({
      type: 'session.restore',
    });

    expect(restoreResult.ok).toBe(true);
    const restored = app2.sessionStore.getState();
    expect(restored.trackOrder).toEqual(['track-1']);
    expect(restored.tracksById['track-1'].regionOrder).toEqual(['region-1']);
  });
});

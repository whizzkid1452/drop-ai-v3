import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './create-app';
import { IndexedDbSessionStorage } from '@/layers/storage/indexeddb/indexed-db-session-storage';
import { FakeAudioProvider } from '@/layers/audio/fake-audio-provider';

const NOW = '2026-05-23T00:00:00.000Z';
const DB_NAME = 'drop-ai-v3-test-create-app';

function fixedIdGenerator() {
  const counters: Record<string, number> = {};
  return {
    next(prefix = 'id') {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
  };
}

afterEach(async () => {
  const cleaner = new IndexedDbSessionStorage({ dbName: DB_NAME });
  await cleaner.clear();
});

describe('createApp default storage selection', () => {
  it('uses IndexedDbSessionStorage when indexedDB is available', () => {
    const app = createApp({
      audioProvider: new FakeAudioProvider(),
      idGenerator: fixedIdGenerator(),
      now: () => NOW,
      sessionId: 'session-1',
      indexedDbName: DB_NAME,
    });

    expect(app.storage).toBeInstanceOf(IndexedDbSessionStorage);
  });

  it('persists across two createApp instances on the same indexedDB name', async () => {
    const writer = createApp({
      audioProvider: new FakeAudioProvider(),
      idGenerator: fixedIdGenerator(),
      now: () => NOW,
      sessionId: 'session-1',
      indexedDbName: DB_NAME,
    });

    await writer.controller.executeCommand({ type: 'track.add' });
    await writer.controller.executeCommand({ type: 'session.save' });

    const reader = createApp({
      audioProvider: new FakeAudioProvider(),
      idGenerator: fixedIdGenerator(),
      now: () => NOW,
      sessionId: 'session-2',
      indexedDbName: DB_NAME,
    });

    const restoreResult = await reader.controller.executeCommand({
      type: 'session.restore',
    });

    expect(restoreResult.ok).toBe(true);
    expect(reader.sessionStore.getState().trackOrder).toEqual(['track-1']);
  });
});

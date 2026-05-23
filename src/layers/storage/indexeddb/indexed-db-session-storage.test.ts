import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { IndexedDbSessionStorage } from './indexed-db-session-storage';
import { runSessionStorageContract } from '../session-storage-provider.contract';
import { createEmptySession } from '@/layers/core/session/session-state';

const DB_NAME_CONTRACT = 'drop-ai-v3-test-contract';
const DB_NAME_CROSS_INSTANCE = 'drop-ai-v3-test-cross-instance';

runSessionStorageContract(
  'IndexedDbSessionStorage',
  () => new IndexedDbSessionStorage({ dbName: DB_NAME_CONTRACT })
);

describe('IndexedDbSessionStorage extras', () => {
  afterEach(async () => {
    const storage = new IndexedDbSessionStorage({
      dbName: DB_NAME_CROSS_INSTANCE,
    });
    await storage.clear();
  });

  it('survives across new adapter instances on the same db name', async () => {
    const writer = new IndexedDbSessionStorage({
      dbName: DB_NAME_CROSS_INSTANCE,
    });
    const session = createEmptySession({
      id: 'session-1',
      now: '2026-05-23T00:00:00.000Z',
    });
    await writer.save(session);

    const reader = new IndexedDbSessionStorage({
      dbName: DB_NAME_CROSS_INSTANCE,
    });
    const loaded = await reader.loadLatest();

    expect(loaded?.id).toBe('session-1');
  });

  it('returns the most recently updated snapshot when multiple sessions exist', async () => {
    const storage = new IndexedDbSessionStorage({
      dbName: DB_NAME_CROSS_INSTANCE,
    });
    const earlier = {
      ...createEmptySession({
        id: 'session-A',
        now: '2026-05-23T00:00:00.000Z',
      }),
    };
    const later = {
      ...createEmptySession({
        id: 'session-B',
        now: '2026-05-23T00:05:00.000Z',
      }),
    };

    await storage.save(earlier);
    await storage.save(later);

    const loaded = await storage.loadLatest();

    expect(loaded?.id).toBe('session-B');
  });
});

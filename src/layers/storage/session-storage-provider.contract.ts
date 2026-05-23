import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptySession } from '@/layers/core/session/session-state';
import type { SessionStorageProvider } from './session-storage-provider';

function makeSession(id = 'session-1', now = '2026-05-23T00:00:00.000Z') {
  return createEmptySession({ id, now });
}

export function runSessionStorageContract(
  label: string,
  createStorage: () => SessionStorageProvider | Promise<SessionStorageProvider>
): void {
  describe(`${label} (SessionStorageProvider contract)`, () => {
    let storage: SessionStorageProvider;

    beforeEach(async () => {
      storage = await createStorage();
      await storage.clear();
    });

    it('returns null when nothing has been saved', async () => {
      const result = await storage.loadLatest();
      expect(result).toBeNull();
    });

    it('returns the saved snapshot after save', async () => {
      const session = makeSession();
      await storage.save(session);

      const result = await storage.loadLatest();

      expect(result).toEqual(session);
    });

    it('overwrites the previous snapshot on subsequent save', async () => {
      await storage.save(makeSession('session-1'));
      await storage.save(makeSession('session-2'));

      const result = await storage.loadLatest();

      expect(result?.id).toBe('session-2');
    });

    it('clears the storage', async () => {
      await storage.save(makeSession());

      await storage.clear();
      const result = await storage.loadLatest();

      expect(result).toBeNull();
    });

    it('isolates the saved snapshot from later external mutation', async () => {
      const session = makeSession();
      await storage.save(session);

      session.playback.bpm = 999;
      const loaded = await storage.loadLatest();

      expect(loaded?.playback.bpm).toBe(120);
    });

    it('isolates the loaded snapshot from consumer mutation', async () => {
      await storage.save(makeSession());

      const firstLoad = await storage.loadLatest();
      if (firstLoad) firstLoad.playback.bpm = 999;
      const secondLoad = await storage.loadLatest();

      expect(secondLoad?.playback.bpm).toBe(120);
    });
  });
}

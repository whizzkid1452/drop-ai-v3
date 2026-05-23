import { describe, expect, it } from 'vitest';
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

describe('in-memory end-to-end session lifecycle', () => {
  it('edits a session, saves, then restores it into a fresh app', async () => {
    const sharedStorage = new MemorySessionStorage();

    const first = createApp({
      audioProvider: new FakeAudioProvider({
        assetDurations: { 'asset-1': 4 },
      }),
      storage: sharedStorage,
      idGenerator: fixedIdGenerator(),
      now: () => NOW,
      sessionId: 'session-1',
    });

    const trackResult = await first.controller.executeCommand({
      type: 'track.add',
    });
    expect(trackResult.ok).toBe(true);

    const regionResult = await first.controller.executeCommand({
      type: 'region.add',
      payload: { trackId: 'track-1', assetId: 'asset-1', startTime: 0 },
    });
    expect(regionResult.ok).toBe(true);

    const splitResult = await first.controller.executeCommand({
      type: 'region.split',
      payload: { trackId: 'track-1', regionId: 'region-1', splitTime: 2 },
    });
    expect(splitResult.ok).toBe(true);

    const saveResult = await first.controller.executeCommand({
      type: 'session.save',
    });
    expect(saveResult.ok).toBe(true);

    const second = createApp({
      audioProvider: new FakeAudioProvider({
        assetDurations: { 'asset-1': 4 },
      }),
      storage: sharedStorage,
      idGenerator: fixedIdGenerator(),
      now: () => NOW,
      sessionId: 'session-1',
    });

    const restoreResult = await second.controller.executeCommand({
      type: 'session.restore',
    });
    expect(restoreResult.ok).toBe(true);

    const restored = second.sessionStore.getState();
    expect(restored.trackOrder).toEqual(['track-1']);
    expect(restored.tracksById['track-1'].regionOrder).toEqual([
      'region-1',
      'region-2',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { createApp } from '@/layers/composition/create-app';
import { FakeAudioEngine } from '@/layers/audio-engine/fake-audio-engine';

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
  it('edits an in-memory session and exports it as WAV data', async () => {
    const app = createApp({
      audioEngine: new FakeAudioEngine({
        assetDurations: { 'asset-1': 4 },
      }),
      idGenerator: fixedIdGenerator(),
      sessionId: 'session-1',
    });

    const trackResult = await app.controller.executeCommand({
      type: 'track.add',
    });
    expect(trackResult.ok).toBe(true);

    const regionResult = await app.controller.executeCommand({
      type: 'region.add',
      payload: { trackId: 'track-1', assetId: 'asset-1', startTime: 0 },
    });
    expect(regionResult.ok).toBe(true);

    const splitResult = await app.controller.executeCommand({
      type: 'region.split',
      payload: { trackId: 'track-1', regionId: 'region-1', splitTime: 2 },
    });
    expect(splitResult.ok).toBe(true);

    const session = app.sessionReader.getState();
    expect(session.trackOrder).toEqual(['track-1']);
    expect(session.tracksById['track-1'].regionOrder).toEqual([
      'region-1',
      'region-2',
    ]);

    const exportResult = await app.controller.executeCommand({
      type: 'session.export',
    });
    expect(exportResult.ok).toBe(true);
  });
});

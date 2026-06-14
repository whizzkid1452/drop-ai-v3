import { describe, expect, it } from 'vitest';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createApp } from '@/composition/create-app';
import { uploadFileToSession } from './upload-session-flow';

describe('uploadFileToSession', () => {
  it('registers an asset, creates a track, and adds one region', async () => {
    const app = createApp({
      audioEngine: new FakeAudioEngine({
        assetDurations: { 'asset-1': 4 },
      }),
      idGenerator: createPerPrefixIdGenerator(),
      sessionId: 'session-1',
    });
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });

    const result = await uploadFileToSession(file, app.controller);

    expect(result).toEqual({
      ok: true,
      uploadInfo: {
        assetId: 'asset-1',
        duration: 4,
        filename: 'loop.wav',
        regionId: 'region-1',
        trackId: 'track-1',
      },
    });
    expect(app.sessionReader.getState().trackOrder).toEqual(['track-1']);
    expect(app.sessionReader.getState().tracksById['track-1']).toMatchObject({
      id: 'track-1',
      regionOrder: ['region-1'],
    });
  });
});

function createPerPrefixIdGenerator() {
  const counters: Record<string, number> = {};

  return {
    next(prefix = 'id') {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
  };
}

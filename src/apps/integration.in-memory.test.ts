import { describe, expect, it } from 'vitest';
import { createApp } from '@/composition/create-app';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createCallRecorder } from '@/testing/call-recorder';

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
  it('registers an asset, edits an in-memory session, and completes a WAV export', async () => {
    const recorder = createCallRecorder();
    const app = createApp({
      audioEngine: new FakeAudioEngine({
        recorder,
        assetDurations: { 'asset-1': 4 },
      }),
      idGenerator: fixedIdGenerator(),
      sessionId: 'session-1',
    });
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });

    const assetResult = await app.controller.executeCommand({
      type: 'asset.register',
      payload: { file },
    });
    expect(assetResult.ok).toBe(true);
    if (!assetResult.ok) {
      throw new Error(assetResult.error.message);
    }
    const asset = assetResult.data;
    expect(asset).toEqual({ id: 'asset-1', duration: 4 });

    const trackResult = await app.controller.executeCommand({
      type: 'track.add',
    });
    expect(trackResult.ok).toBe(true);
    if (!trackResult.ok) {
      throw new Error(trackResult.error.message);
    }
    const track = trackResult.data;
    expect(track).toEqual({ id: 'track-1' });

    const regionResult = await app.controller.executeCommand({
      type: 'region.add',
      payload: { trackId: track.id, assetId: asset.id, startTime: 0 },
    });
    expect(regionResult.ok).toBe(true);
    if (!regionResult.ok) {
      throw new Error(regionResult.error.message);
    }
    const region = regionResult.data;
    expect(region).toEqual({ id: 'region-1' });

    const splitResult = await app.controller.executeCommand({
      type: 'region.split',
      payload: { trackId: track.id, regionId: region.id, splitTime: 2 },
    });
    expect(splitResult.ok).toBe(true);
    if (!splitResult.ok) {
      throw new Error(splitResult.error.message);
    }
    const split = splitResult.data;
    expect(split).toEqual({ leftId: 'region-1', rightId: 'region-2' });

    const session = app.sessionReader.getState();
    expect(session.trackOrder).toEqual([track.id]);
    expect(session.tracksById[track.id].regionOrder).toEqual([
      split.leftId,
      split.rightId,
    ]);
    expect(session.tracksById[track.id].regionsById[split.leftId].assetId).toBe(
      asset.id
    );

    // 같은 편집이 audio engine 에도 그대로 도달했는지 — session 과 audio 의 일관성.
    expect(recorder.getCalls('importFileAsset')[0].args).toEqual([
      asset.id,
      file,
    ]);
    expect(recorder.getCalls('createTrack')[0].args).toEqual([track.id]);

    const addRegionCalls = recorder.getCalls('addRegion');
    expect(addRegionCalls).toHaveLength(2);
    expect(addRegionCalls[0].args[0]).toEqual({
      trackId: track.id,
      regionId: region.id,
      assetId: asset.id,
      startTime: 0,
      duration: 4,
      offset: 0,
    });
    expect(addRegionCalls[1].args[0]).toEqual({
      trackId: track.id,
      regionId: split.rightId,
      assetId: asset.id,
      startTime: 2,
      duration: 2,
      offset: 2,
    });
    expect(recorder.getCalls('resizeRegion')[0].args).toEqual([
      track.id,
      split.leftId,
      2,
    ]);

    const exportResult = await app.controller.executeCommand({
      type: 'session.export',
    });
    expect(exportResult.ok).toBe(true);
  });
});

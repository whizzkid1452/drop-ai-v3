import { describe, expect, it } from 'vitest';
import { FakeAudioProvider } from './fake-audio-provider';
import { createCallRecorder } from '@/layers/testing/call-recorder';
import { createEmptySession } from '@/layers/core/session/session-state';
import {
  addRegion,
  addTrack,
} from '@/layers/core/session/session-operations';

const NOW = '2026-05-23T00:00:00.000Z';

describe('FakeAudioProvider', () => {
  it('records play, pause, stop calls in order', async () => {
    const recorder = createCallRecorder();
    const provider = new FakeAudioProvider({ recorder });

    await provider.play();
    provider.pause();
    provider.stop();

    expect(recorder.calls.map(call => call.method)).toEqual([
      'play',
      'pause',
      'stop',
    ]);
  });

  it('returns the configured duration for a known asset', async () => {
    const provider = new FakeAudioProvider({
      assetDurations: { 'asset-1': 4.5 },
    });

    const duration = await provider.getAssetDuration('asset-1');

    expect(duration).toBe(4.5);
  });

  it('defaults asset duration to 1 second when not configured', async () => {
    const provider = new FakeAudioProvider();

    const duration = await provider.getAssetDuration('unknown-asset');

    expect(duration).toBe(1);
  });

  it('records syncSession in deterministic order: tracks then regions', async () => {
    const recorder = createCallRecorder();
    const provider = new FakeAudioProvider({ recorder });

    let session = createEmptySession({ id: 'session-1', now: NOW });
    session = addTrack(session, { trackId: 'track-1', name: 'A', now: NOW });
    session = addTrack(session, { trackId: 'track-2', name: 'B', now: NOW });
    session = addRegion(session, {
      trackId: 'track-1',
      regionId: 'region-1',
      assetId: 'asset-1',
      startTime: 0,
      duration: 2,
      offset: 0,
      now: NOW,
    });
    session = addRegion(session, {
      trackId: 'track-2',
      regionId: 'region-2',
      assetId: 'asset-2',
      startTime: 1,
      duration: 3,
      offset: 0,
      now: NOW,
    });

    await provider.syncSession(session);

    const methodOrder = recorder.calls.map(call => call.method);
    expect(methodOrder).toEqual([
      'syncSession',
      'createTrack',
      'createTrack',
      'addRegion',
      'addRegion',
    ]);
    expect(recorder.calls[1].args).toEqual(['track-1']);
    expect(recorder.calls[2].args).toEqual(['track-2']);
  });

  it('records track mixer calls with arguments', () => {
    const recorder = createCallRecorder();
    const provider = new FakeAudioProvider({ recorder });

    provider.setTrackVolume('track-1', 0.5);
    provider.setTrackMute('track-1', true);
    provider.setTrackSolo('track-1', false);
    provider.setTrackPan('track-1', -0.3);

    expect(recorder.calls).toEqual([
      { method: 'setTrackVolume', args: ['track-1', 0.5] },
      { method: 'setTrackMute', args: ['track-1', true] },
      { method: 'setTrackSolo', args: ['track-1', false] },
      { method: 'setTrackPan', args: ['track-1', -0.3] },
    ]);
  });
});

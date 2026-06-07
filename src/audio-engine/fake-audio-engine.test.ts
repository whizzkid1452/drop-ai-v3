import { describe, expect, it } from 'vitest';
import { FakeAudioEngine } from './fake-audio-engine';
import { createCallRecorder } from '@/testing/call-recorder';

describe('FakeAudioEngine', () => {
  it('records play, pause, stop calls in order', async () => {
    const recorder = createCallRecorder();
    const provider = new FakeAudioEngine({ recorder });

    await provider.play();
    provider.pause();
    provider.stop();

    expect(recorder.calls.map((call) => call.method)).toEqual([
      'play',
      'pause',
      'stop',
    ]);
  });

  it('returns the configured duration for a known asset', async () => {
    const provider = new FakeAudioEngine({
      assetDurations: { 'asset-1': 4.5 },
    });

    const duration = await provider.getAssetDuration('asset-1');

    expect(duration).toBe(4.5);
  });

  it('defaults asset duration to 1 second when not configured', async () => {
    const provider = new FakeAudioEngine();

    const duration = await provider.getAssetDuration('unknown-asset');

    expect(duration).toBe(1);
  });

  it('imports a file asset, records the call, and returns its duration', async () => {
    const recorder = createCallRecorder();
    const provider = new FakeAudioEngine({
      recorder,
      assetDurations: { 'asset-1': 4.5 },
    });
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });

    const result = await provider.importFileAsset('asset-1', file);

    expect(result).toEqual({ duration: 4.5 });
    expect(recorder.getCalls('importFileAsset')[0].args).toEqual([
      'asset-1',
      file,
    ]);
    await expect(provider.getAssetDuration('asset-1')).resolves.toBe(4.5);
  });

  it('records track mixer calls with arguments', () => {
    const recorder = createCallRecorder();
    const provider = new FakeAudioEngine({ recorder });

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

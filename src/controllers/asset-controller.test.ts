import { describe, expect, it } from 'vitest';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createCallRecorder } from '@/testing/call-recorder';
import type { IdGenerator } from './id-generator';
import { AssetController } from './asset-controller';

function fixedIdGenerator(): IdGenerator {
  let assetCounter = 0;
  return {
    next(prefix) {
      if (prefix === 'asset') {
        assetCounter += 1;
        return `asset-${assetCounter}`;
      }
      return `${prefix ?? 'id'}-x`;
    },
  };
}

describe('AssetController.registerFileAsset', () => {
  it('imports the file into the audio engine using a generated asset id', async () => {
    const recorder = createCallRecorder();
    const audio = new FakeAudioEngine({
      recorder,
      assetDurations: { 'asset-1': 4.5 },
    });
    const controller = new AssetController({
      audioEngine: audio,
      idGenerator: fixedIdGenerator(),
    });
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });

    const result = await controller.registerFileAsset(file);

    expect(result).toEqual({ id: 'asset-1', duration: 4.5 });
    expect(recorder.getCalls('importFileAsset')[0].args).toEqual([
      'asset-1',
      file,
    ]);
  });
});

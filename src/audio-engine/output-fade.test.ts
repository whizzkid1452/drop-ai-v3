import { describe, expect, it } from 'vitest';
import { applyOutputFade } from './output-fade';

describe('applyOutputFade', () => {
  it('applies fade in and fade out gains to every channel', () => {
    const buffer = createAudioBufferFixture({
      channels: 2,
      sampleRate: 4,
      samples: [1, 1, 1, 1],
    });

    applyOutputFade(buffer, {
      fadeInSeconds: 0.5,
      fadeOutSeconds: 0.5,
    });

    expect(Array.from(buffer.getChannelData(0))).toEqual([0, 0.5, 0.5, 0]);
    expect(Array.from(buffer.getChannelData(1))).toEqual([0, 0.5, 0.5, 0]);
  });

  it('leaves samples unchanged when both fade durations are zero', () => {
    const buffer = createAudioBufferFixture({
      channels: 1,
      sampleRate: 4,
      samples: [0.25, 0.5, 0.75, 1],
    });

    applyOutputFade(buffer, {
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
    });

    expect(Array.from(buffer.getChannelData(0))).toEqual([0.25, 0.5, 0.75, 1]);
  });
});

function createAudioBufferFixture(input: {
  channels: number;
  sampleRate: number;
  samples: number[];
}): AudioBuffer {
  const data = Array.from({ length: input.channels }, () =>
    Float32Array.from(input.samples)
  );

  return {
    getChannelData: (channel: number) => data[channel],
    length: input.samples.length,
    numberOfChannels: input.channels,
    sampleRate: input.sampleRate,
  } as unknown as AudioBuffer;
}

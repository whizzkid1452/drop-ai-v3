import { describe, expect, it } from 'vitest';
import { encodeWav, encodeWavBytes } from './wav-encoder';

const SAMPLE_RATE = 44100;
const WAV_HEADER_BYTES = 44;

function createMockAudioBuffer(
  channels: number,
  samples: number,
  sampleRate = SAMPLE_RATE
): AudioBuffer {
  const data: Float32Array[] = [];
  for (let channel = 0; channel < channels; channel += 1) {
    const arr = new Float32Array(samples);
    for (let i = 0; i < samples; i += 1) {
      arr[i] = (channel + 1) * 0.1 * Math.sin(i * 0.01);
    }
    data.push(arr);
  }
  return {
    numberOfChannels: channels,
    sampleRate,
    length: samples,
    getChannelData: (ch: number) => data[ch],
  } as unknown as AudioBuffer;
}

function readString(view: DataView, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += String.fromCharCode(view.getUint8(offset + i));
  }
  return out;
}

describe('encodeWavBytes', () => {
  it('starts with the RIFF/WAVE magic bytes', () => {
    const view = new DataView(encodeWavBytes(createMockAudioBuffer(1, 100)));

    expect(readString(view, 0, 4)).toBe('RIFF');
    expect(readString(view, 8, 4)).toBe('WAVE');
    expect(readString(view, 12, 4)).toBe('fmt ');
    expect(readString(view, 36, 4)).toBe('data');
  });

  it('uses IEEE float (format 3) at 32-bit depth', () => {
    const view = new DataView(encodeWavBytes(createMockAudioBuffer(1, 100)));

    expect(view.getUint16(20, true)).toBe(3);
    expect(view.getUint16(34, true)).toBe(32);
  });

  it('writes the correct sample rate and channel count', () => {
    const view = new DataView(
      encodeWavBytes(createMockAudioBuffer(2, 100, 48000))
    );

    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48000);
  });

  it('produces a buffer whose total length matches header + data', () => {
    const samples = 256;
    const channels = 1;
    const bytesPerSample = 4;
    const dataBytes = samples * channels * bytesPerSample;

    const arrayBuffer = encodeWavBytes(
      createMockAudioBuffer(channels, samples)
    );

    expect(arrayBuffer.byteLength).toBe(WAV_HEADER_BYTES + dataBytes);
  });

  it('interleaves stereo channels', () => {
    const channels = 2;
    const samples = 4;
    const buffer = createMockAudioBuffer(channels, samples);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const view = new DataView(encodeWavBytes(buffer));

    for (let i = 0; i < samples; i += 1) {
      const leftIndex = WAV_HEADER_BYTES + i * 2 * 4;
      const rightIndex = leftIndex + 4;
      expect(view.getFloat32(leftIndex, true)).toBeCloseTo(left[i], 5);
      expect(view.getFloat32(rightIndex, true)).toBeCloseTo(right[i], 5);
    }
  });
});

describe('encodeWav', () => {
  it('wraps the encoded bytes as an audio/wav Blob', () => {
    const blob = encodeWav(createMockAudioBuffer(1, 100));

    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(WAV_HEADER_BYTES + 100 * 4);
  });
});

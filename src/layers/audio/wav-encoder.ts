const WAV_HEADER_BYTES = 44;
const FORMAT_IEEE_FLOAT = 3;
const BIT_DEPTH = 32;
const BYTES_PER_SAMPLE = 4;

export function encodeWavBytes(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;

  const interleaved = interleaveChannels(audioBuffer);
  const dataBytes = interleaved.length * BYTES_PER_SAMPLE;
  const totalBytes = WAV_HEADER_BYTES + dataBytes;

  const arrayBuffer = new ArrayBuffer(totalBytes);
  const view = new DataView(arrayBuffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, totalBytes - 8, true);
  writeAscii(view, 8, 'WAVE');

  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, FORMAT_IEEE_FLOAT, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * BYTES_PER_SAMPLE, true);
  view.setUint16(32, numChannels * BYTES_PER_SAMPLE, true);
  view.setUint16(34, BIT_DEPTH, true);

  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  new Float32Array(arrayBuffer, WAV_HEADER_BYTES).set(interleaved);

  return arrayBuffer;
}

export function encodeWav(audioBuffer: AudioBuffer): Blob {
  return new Blob([encodeWavBytes(audioBuffer)], { type: 'audio/wav' });
}

function interleaveChannels(audioBuffer: AudioBuffer): Float32Array {
  const numChannels = audioBuffer.numberOfChannels;
  if (numChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c += 1) {
    channels.push(audioBuffer.getChannelData(c));
  }

  const frames = channels[0].length;
  const interleaved = new Float32Array(frames * numChannels);
  for (let frame = 0; frame < frames; frame += 1) {
    for (let c = 0; c < numChannels; c += 1) {
      interleaved[frame * numChannels + c] = channels[c][frame];
    }
  }
  return interleaved;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

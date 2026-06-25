export interface OutputFadeInput {
  fadeInSeconds: number;
  fadeOutSeconds: number;
}

export function applyOutputFade(
  audioBuffer: AudioBuffer,
  { fadeInSeconds, fadeOutSeconds }: OutputFadeInput
): void {
  const fadeInSamples = toSampleCount(fadeInSeconds, audioBuffer.sampleRate);
  const fadeOutSamples = toSampleCount(fadeOutSeconds, audioBuffer.sampleRate);

  if (fadeInSamples === 0 && fadeOutSamples === 0) {
    return;
  }

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const samples = audioBuffer.getChannelData(channel);
    applyFadeIn(samples, Math.min(fadeInSamples, samples.length));
    applyFadeOut(samples, Math.min(fadeOutSamples, samples.length));
  }
}

function toSampleCount(seconds: number, sampleRate: number): number {
  if (seconds <= 0) {
    return 0;
  }

  return Math.round(seconds * sampleRate);
}

function applyFadeIn(samples: Float32Array, fadeSamples: number): void {
  if (fadeSamples <= 0) {
    return;
  }

  for (let index = 0; index < fadeSamples; index += 1) {
    samples[index] *= index / fadeSamples;
  }
}

function applyFadeOut(samples: Float32Array, fadeSamples: number): void {
  if (fadeSamples <= 0) {
    return;
  }

  const fadeStart = samples.length - fadeSamples;
  for (let index = 0; index < fadeSamples; index += 1) {
    samples[fadeStart + index] *= (fadeSamples - index - 1) / fadeSamples;
  }
}

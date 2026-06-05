import { describe, expect, it } from 'vitest';
import { runCli } from './cli-runner';
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

function setup() {
  return createApp({
    audioEngine: new FakeAudioEngine({
      assetDurations: { 'asset-1': 4 },
    }),
    idGenerator: fixedIdGenerator(),
    sessionId: 'session-1',
  });
}

describe('runCli', () => {
  it('"track add" creates a track', async () => {
    const app = setup();

    const result = await runCli('track add', { appController: app.controller });

    expect(result.ok).toBe(true);
    expect(app.sessionReader.getState().trackOrder).toEqual(['track-1']);
  });

  it('"volume track-1 0.5" updates the track volume', async () => {
    const app = setup();
    await runCli('track add', { appController: app.controller });

    const result = await runCli('volume track-1 0.5', {
      appController: app.controller,
    });

    expect(result.ok).toBe(true);
    expect(app.sessionReader.getState().tracksById['track-1'].volume).toBe(0.5);
  });

  it('"session export" exports the current in-memory session', async () => {
    const app = setup();
    await runCli('track add', { appController: app.controller });
    await runCli('region add track-1 asset-1 0', {
      appController: app.controller,
    });

    const result = await runCli('session export mix.wav', {
      appController: app.controller,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ filename: 'mix.wav' });
    }
  });

  it('does not call any controller when the cli input is invalid', async () => {
    const app = setup();

    const result = await runCli('not-a-real-command', {
      appController: app.controller,
    });

    expect(result.ok).toBe(false);
    expect(app.sessionReader.getState().trackOrder).toEqual([]);
  });
});

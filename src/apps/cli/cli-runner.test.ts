import { describe, expect, it } from 'vitest';
import { runCli } from './cli-runner';
import { createApp } from '@/composition/create-app';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';

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
    if (result.ok && !('kind' in result)) {
      expect(result.data).toMatchObject({ filename: 'mix.wav' });
    }
  });

  it('handles help and commands without changing the session', async () => {
    const app = setup();

    const helpResult = await runCli('help', { appController: app.controller });
    const commandsResult = await runCli('commands', {
      appController: app.controller,
    });

    expect(helpResult).toMatchObject({
      ok: true,
      kind: 'local',
    });
    if ('kind' in helpResult) {
      expect(helpResult.output).toContain('Drop AI CLI');
    }
    expect(commandsResult).toMatchObject({
      ok: true,
      kind: 'local',
    });
    if ('kind' in commandsResult) {
      expect(commandsResult.output).toContain('region split');
    }
    expect(app.sessionReader.getState().trackOrder).toEqual([]);
  });

  it('prints a status summary from the current session', async () => {
    const app = setup();
    await runCli('track add', { appController: app.controller });

    const result = await runCli('status', {
      appController: app.controller,
      getStatusText: () => {
        const session = app.sessionReader.getState();
        return [
          `Session: ${session.id}`,
          `Tracks: ${session.trackOrder.length}`,
        ].join('\n');
      },
      uploadInfo: {
        assetId: 'asset-1',
        duration: 4,
        filename: 'loop.wav',
        regionId: 'region-1',
        trackId: 'track-1',
      },
    });

    expect(result).toMatchObject({
      ok: true,
      kind: 'local',
    });
    if ('kind' in result) {
      expect(result.output).toContain('Session: session-1');
      expect(result.output).toContain('Tracks: 1');
      expect(result.output).toContain('Uploaded asset: asset-1');
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

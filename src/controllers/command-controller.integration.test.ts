import { beforeEach, describe, expect, it } from 'vitest';
import { AppController } from './app-controller';
import { AssetController } from './asset-controller';
import { ExportRangeController } from './export-range-controller';
import { PlaybackController } from './playback-controller';
import { SessionExportController } from './session-export-controller';
import { TrackController } from './track-controller';
import type { IdGenerator } from './id-generator';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import {
  createSessionStore,
  type ISessionStore,
} from '@/session/session-store';
import { createEmptySession } from '@/session/session-state';
import { createCallRecorder } from '@/testing/call-recorder';

function isExportResultData(
  value: unknown
): value is { blob: Blob; filename: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'blob' in value &&
    value.blob instanceof Blob &&
    'filename' in value &&
    typeof value.filename === 'string'
  );
}

function fixedIdGenerator(): IdGenerator {
  const counters: Record<string, number> = {};
  return {
    next(prefix = 'id') {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
  };
}

interface Harness {
  app: AppController;
  store: ISessionStore;
}

function setup(): Harness {
  const store = createSessionStore({
    initialSession: createEmptySession({ id: 'session-1' }),
  });
  const recorder = createCallRecorder();
  const audio = new FakeAudioEngine({
    recorder,
    assetDurations: { 'asset-1': 4 },
  });
  const idGenerator = fixedIdGenerator();

  const track = new TrackController({
    sessionStore: store,
    audioEngine: audio,
    idGenerator,
  });
  const playback = new PlaybackController({
    sessionStore: store,
    audioEngine: audio,
  });
  const asset = new AssetController({
    audioEngine: audio,
    idGenerator,
  });
  const sessionExport = new SessionExportController({
    sessionStore: store,
    audioEngine: audio,
  });
  const exportRange = new ExportRangeController({
    sessionStore: store,
    audioEngine: audio,
  });

  const app = new AppController({
    playbackController: playback,
    assetController: asset,
    exportRangeController: exportRange,
    trackController: track,
    sessionExportController: sessionExport,
  });

  return { app, store };
}

describe('command-controller integration: result shapes', () => {
  let h: Harness;
  beforeEach(() => {
    h = setup();
  });

  it('track.add returns data { id }', async () => {
    const result = await h.app.executeCommand({ type: 'track.add' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ id: 'track-1' });
    }
  });

  it('region.split returns data { leftId, rightId }', async () => {
    await h.app.executeCommand({ type: 'track.add' });
    await h.app.executeCommand({
      type: 'region.add',
      payload: { trackId: 'track-1', assetId: 'asset-1', startTime: 2 },
    });

    const result = await h.app.executeCommand({
      type: 'region.split',
      payload: {
        trackId: 'track-1',
        regionId: 'region-1',
        splitTime: 4,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        leftId: 'region-1',
        rightId: 'region-2',
      });
    }
  });

  it('track.volume.set returns ok without data', async () => {
    await h.app.executeCommand({ type: 'track.add' });
    const result = await h.app.executeCommand({
      type: 'track.volume.set',
      payload: { trackId: 'track-1', volume: 0.5 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeUndefined();
    }
  });

  it('asset.register returns data { id, duration }', async () => {
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });

    const result = await h.app.executeCommand({
      type: 'asset.register',
      payload: { file },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ id: 'asset-1', duration: 4 });
    }
  });
});

describe('command-controller integration: validation vs execution failure', () => {
  let h: Harness;
  beforeEach(() => {
    h = setup();
  });

  it('returns COMMAND_VALIDATION_FAILED when payload is invalid (volume out of range)', async () => {
    await h.app.executeCommand({ type: 'track.add' });
    const result = await h.app.executeCommand({
      type: 'track.volume.set',
      payload: { trackId: 'track-1', volume: 2 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMMAND_VALIDATION_FAILED');
    }
  });

  it('returns COMMAND_EXECUTION_FAILED when a known command targets a missing track', async () => {
    const result = await h.app.executeCommand({
      type: 'track.remove',
      payload: { trackId: 'missing-track' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMMAND_EXECUTION_FAILED');
      expect(result.error.message).toMatch(/track/i);
    }
  });
});

describe('command-controller integration: session.export', () => {
  it('returns a blob and filename when the session has at least one region', async () => {
    const h = setup();
    await h.app.executeCommand({ type: 'track.add' });
    await h.app.executeCommand({
      type: 'region.add',
      payload: { trackId: 'track-1', assetId: 'asset-1', startTime: 0 },
    });

    const result = await h.app.executeCommand({ type: 'session.export' });

    expect(result.ok).toBe(true);
    if (result.ok && isExportResultData(result.data)) {
      expect(result.data.blob).toBeInstanceOf(Blob);
      expect(result.data.filename).toBe('session-1.wav');
    }
  });

  it('returns COMMAND_EXECUTION_FAILED when the session is empty', async () => {
    const h = setup();

    const result = await h.app.executeCommand({ type: 'session.export' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMMAND_EXECUTION_FAILED');
    }
  });
});

describe('command-controller integration: session.exportRange', () => {
  it('updates export range state through commands', async () => {
    const h = setup();

    await h.app.executeCommand({
      type: 'session.exportRange.end.set',
      payload: { seconds: 8 },
    });
    await h.app.executeCommand({
      type: 'session.exportRange.start.set',
      payload: { seconds: 2 },
    });

    expect(h.store.getState().exportRange).toMatchObject({
      endSeconds: 8,
      startSeconds: 2,
    });
  });

  it('exports a range when it intersects an existing region', async () => {
    const h = setup();
    await h.app.executeCommand({ type: 'track.add' });
    await h.app.executeCommand({
      type: 'region.add',
      payload: { trackId: 'track-1', assetId: 'asset-1', startTime: 0 },
    });
    await h.app.executeCommand({
      type: 'session.exportRange.end.set',
      payload: { seconds: 3 },
    });
    await h.app.executeCommand({
      type: 'session.exportRange.start.set',
      payload: { seconds: 1 },
    });

    const result = await h.app.executeCommand({
      type: 'session.exportRange.export',
      payload: { filename: 'clip.wav' },
    });

    expect(result.ok).toBe(true);
    if (result.ok && isExportResultData(result.data)) {
      expect(result.data.filename).toBe('clip.wav');
      expect(result.data.blob).toBeInstanceOf(Blob);
    }
  });
});

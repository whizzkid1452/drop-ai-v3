import { describe, expect, it } from 'vitest';
import { parseCliInput } from './cli-parser';

describe('parseCliInput', () => {
  it('maps playback input to playback commands', () => {
    expect(parseCliInput('play')).toEqual({
      ok: true,
      command: { type: 'playback.play' },
    });
    expect(parseCliInput('seek 12.5')).toEqual({
      ok: true,
      command: { type: 'playback.seek', payload: { seconds: 12.5 } },
    });
    expect(parseCliInput('loop 1 4')).toEqual({
      ok: true,
      command: {
        type: 'playback.loop.set',
        payload: { start: 1, end: 4, enabled: true },
      },
    });
    expect(parseCliInput('loop off')).toEqual({
      ok: true,
      command: {
        type: 'playback.loop.set',
        payload: { start: 0, end: 1, enabled: false },
      },
    });
  });

  it('maps track input to track commands', () => {
    expect(parseCliInput('track add')).toEqual({
      ok: true,
      command: { type: 'track.add' },
    });
    expect(parseCliInput('track remove track-1')).toEqual({
      ok: true,
      command: { type: 'track.remove', payload: { trackId: 'track-1' } },
    });
    expect(parseCliInput('volume track-1 0.5')).toEqual({
      ok: true,
      command: {
        type: 'track.volume.set',
        payload: { trackId: 'track-1', volume: 0.5 },
      },
    });
    expect(parseCliInput('mute track-1 on')).toEqual({
      ok: true,
      command: {
        type: 'track.mute.set',
        payload: { trackId: 'track-1', muted: true },
      },
    });
    expect(parseCliInput('pan track-1 -0.25')).toEqual({
      ok: true,
      command: {
        type: 'track.pan.set',
        payload: { trackId: 'track-1', pan: -0.25 },
      },
    });
  });

  it('maps region input to region commands', () => {
    expect(parseCliInput('region add track-1 asset-1')).toEqual({
      ok: true,
      command: {
        type: 'region.add',
        payload: { trackId: 'track-1', assetId: 'asset-1', startTime: 0 },
      },
    });
    expect(parseCliInput('region move track-1 region-1 3')).toEqual({
      ok: true,
      command: {
        type: 'region.move',
        payload: { trackId: 'track-1', regionId: 'region-1', startTime: 3 },
      },
    });
    expect(parseCliInput('region split track-1 region-1 1.5')).toEqual({
      ok: true,
      command: {
        type: 'region.split',
        payload: { trackId: 'track-1', regionId: 'region-1', splitTime: 1.5 },
      },
    });
    expect(parseCliInput('region resize track-1 region-1 4')).toEqual({
      ok: true,
      command: {
        type: 'region.resize',
        payload: { trackId: 'track-1', regionId: 'region-1', duration: 4 },
      },
    });
  });

  it('maps session input to session commands', () => {
    expect(parseCliInput('session save')).toEqual({
      ok: true,
      command: { type: 'session.save' },
    });
    expect(parseCliInput('session restore')).toEqual({
      ok: true,
      command: { type: 'session.restore' },
    });
    expect(parseCliInput('session export final mix.wav')).toEqual({
      ok: true,
      command: {
        type: 'session.export',
        payload: { filename: 'final mix.wav' },
      },
    });
  });

  it('returns a parser error for missing or unknown commands', () => {
    expect(parseCliInput('')).toEqual({
      ok: false,
      error: 'Command is required.',
    });
    expect(parseCliInput('warp 10')).toEqual({
      ok: false,
      error: 'Unknown command: warp.',
    });
  });

  it('returns a validation error for payloads rejected by the command schema', () => {
    expect(parseCliInput('seek -1')).toEqual({
      ok: false,
      error: 'Command payload is invalid.',
    });
    expect(parseCliInput('volume track-1 1.5')).toEqual({
      ok: false,
      error: 'Command payload is invalid.',
    });
    expect(parseCliInput('region resize track-1 region-1 0')).toEqual({
      ok: false,
      error: 'Command payload is invalid.',
    });
  });
});

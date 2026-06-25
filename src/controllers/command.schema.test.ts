import { describe, expect, it } from 'vitest';
import { commandSchema, parseCommand } from './command.schema';

describe('commandSchema', () => {
  it('accepts playback commands without payload', () => {
    expect(parseCommand({ type: 'playback.play' })).toEqual({
      type: 'playback.play',
    });
    expect(parseCommand({ type: 'playback.pause' })).toEqual({
      type: 'playback.pause',
    });
    expect(parseCommand({ type: 'playback.stop' })).toEqual({
      type: 'playback.stop',
    });
  });

  it('rejects unknown command types', () => {
    expect(() => parseCommand({ type: 'timeline.zoom' })).toThrow();
  });

  it('validates playback payload ranges', () => {
    expect(
      commandSchema.safeParse({
        type: 'playback.seek',
        payload: { seconds: 12.5 },
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'playback.seek',
        payload: { seconds: -1 },
      }).success
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'playback.loop.set',
        payload: { start: 4, end: 2, enabled: true },
      }).success
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'playback.masterVolume.set',
        payload: { volume: 1.1 },
      }).success
    ).toBe(false);
  });

  it('validates track command payloads', () => {
    expect(
      commandSchema.safeParse({
        type: 'track.add',
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'track.volume.set',
        payload: { trackId: 'track-1', volume: 0.5 },
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'track.volume.set',
        payload: { trackId: 'track-1', volume: -0.1 },
      }).success
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'track.pan.set',
        payload: { trackId: 'track-1', pan: 1.5 },
      }).success
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'track.mute.set',
        payload: { trackId: '', muted: true },
      }).success
    ).toBe(false);
  });

  it('validates region command payloads', () => {
    expect(
      commandSchema.safeParse({
        type: 'region.add',
        payload: { trackId: 'track-1', assetId: 'asset-1', startTime: 0 },
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'region.move',
        payload: { trackId: 'track-1', regionId: 'region-1', startTime: -1 },
      }).success
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'region.resize',
        payload: { trackId: 'track-1', regionId: 'region-1', duration: 0 },
      }).success
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'region.remove',
        payload: { trackId: 'track-1', regionId: 'region-1' },
      }).success
    ).toBe(true);
  });

  it('validates asset commands', () => {
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });

    expect(
      commandSchema.safeParse({
        type: 'asset.register',
        payload: { file },
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'asset.register',
        payload: { file: 'loop.wav' },
      }).success
    ).toBe(false);
  });

  it('validates session commands', () => {
    expect(
      commandSchema.safeParse({
        type: 'session.export',
        payload: { filename: 'mix.wav' },
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'session.export',
        payload: { filename: '' },
      }).success
    ).toBe(false);
  });

  it('validates export range commands', () => {
    expect(
      commandSchema.safeParse({
        type: 'session.exportRange.start.set',
        payload: { seconds: 1.5 },
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'session.exportRange.end.set',
        payload: { seconds: 4 },
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'session.exportRange.fadeIn.set',
        payload: { seconds: 0.25 },
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'session.exportRange.fadeOut.set',
        payload: { seconds: 0.25 },
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'session.exportRange.preview.play',
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'session.exportRange.export',
        payload: { filename: 'clip.wav' },
      }).success
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        type: 'session.exportRange.start.set',
        payload: { seconds: -1 },
      }).success
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'session.exportRange.export',
        payload: { filename: '' },
      }).success
    ).toBe(false);
  });

  it('rejects extra fields before a command can execute', () => {
    expect(
      commandSchema.safeParse({
        type: 'track.add',
        payload: { trackId: 'unexpected' },
      }).success
    ).toBe(false);
  });
});

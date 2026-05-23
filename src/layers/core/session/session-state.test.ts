import { describe, expect, it } from 'vitest';
import { createEmptySession } from './session-state';

const SESSION_FIXTURE = {
  id: 'session-1',
  now: '2026-05-23T00:00:00.000Z',
} as const;

describe('createEmptySession', () => {
  it('returns a session with the provided id and updatedAt', () => {
    const session = createEmptySession(SESSION_FIXTURE);

    expect(session.id).toBe('session-1');
    expect(session.updatedAt).toBe('2026-05-23T00:00:00.000Z');
  });

  it('starts with an empty trackOrder and empty tracksById', () => {
    const session = createEmptySession(SESSION_FIXTURE);

    expect(session.trackOrder).toEqual([]);
    expect(session.tracksById).toEqual({});
  });

  it('defaults playback to not playing, position 0, bpm 120, master volume 1', () => {
    const session = createEmptySession(SESSION_FIXTURE);

    expect(session.playback.playing).toBe(false);
    expect(session.playback.positionSeconds).toBe(0);
    expect(session.playback.bpm).toBe(120);
    expect(session.playback.masterVolume).toBe(1);
  });

  it('defaults loop to disabled with start 0 and end 4', () => {
    const session = createEmptySession(SESSION_FIXTURE);

    expect(session.playback.loop).toEqual({
      start: 0,
      end: 4,
      enabled: false,
    });
  });

  it('starts clean (dirty = false)', () => {
    const session = createEmptySession(SESSION_FIXTURE);

    expect(session.dirty).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { createApp } from './create-app';
import { FakeAudioProvider } from '@/layers/audio/fake-audio-provider';
import { MemorySessionStorage } from '@/layers/storage/memory-session-storage';
import { createCallRecorder } from '@/layers/testing/call-recorder';

const NOW = '2026-05-23T00:00:00.000Z';

function fixedNow(): string {
  return NOW;
}

function createIdGenerator() {
  const counters: Record<string, number> = {};
  return {
    next(prefix = 'id') {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
  };
}

describe('createApp', () => {
  it('returns an AppController with controller surfaces wired', () => {
    const app = createApp({
      audioProvider: new FakeAudioProvider(),
      storage: new MemorySessionStorage(),
      idGenerator: createIdGenerator(),
      now: fixedNow,
      sessionId: 'session-1',
    });

    expect(app.controller).toBeDefined();
    expect(app.controller.executeCommand).toBeInstanceOf(Function);
    expect(app.sessionStore.getState().id).toBe('session-1');
  });

  it('routes track.add through the wired controllers', async () => {
    const recorder = createCallRecorder();
    const app = createApp({
      audioProvider: new FakeAudioProvider({ recorder }),
      storage: new MemorySessionStorage(),
      idGenerator: createIdGenerator(),
      now: fixedNow,
      sessionId: 'session-1',
    });

    const result = await app.controller.executeCommand({ type: 'track.add' });

    expect(result.ok).toBe(true);
    expect(app.sessionStore.getState().trackOrder).toEqual(['track-1']);
    expect(recorder.getCalls('createTrack').map(c => c.args)).toEqual([
      ['track-1'],
    ]);
  });

  it('uses MemorySessionStorage by default when none is provided', async () => {
    const app = createApp({
      audioProvider: new FakeAudioProvider(),
      idGenerator: createIdGenerator(),
      now: fixedNow,
      sessionId: 'session-1',
    });

    await app.controller.executeCommand({ type: 'track.add' });
    const saveResult = await app.controller.executeCommand({
      type: 'session.save',
    });

    expect(saveResult.ok).toBe(true);
  });

  it('uses FakeAudioProvider by default when none is provided', async () => {
    const app = createApp({
      storage: new MemorySessionStorage(),
      idGenerator: createIdGenerator(),
      now: fixedNow,
      sessionId: 'session-1',
    });

    const result = await app.controller.executeCommand({ type: 'track.add' });

    expect(result.ok).toBe(true);
  });

  it('does not enable autosave by default', async () => {
    const app = createApp({
      audioProvider: new FakeAudioProvider(),
      storage: new MemorySessionStorage(),
      idGenerator: createIdGenerator(),
      now: fixedNow,
      sessionId: 'session-1',
    });

    expect(app.autosave).toBeUndefined();
  });

  it('disposes cleanly', () => {
    const app = createApp({
      audioProvider: new FakeAudioProvider(),
      storage: new MemorySessionStorage(),
      idGenerator: createIdGenerator(),
      now: fixedNow,
      sessionId: 'session-1',
    });

    expect(() => app.dispose()).not.toThrow();
  });
});

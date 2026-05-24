import { describe, expect, it } from 'vitest';
import { createApp } from './create-app';
import { FakeAudioProvider } from '@/layers/audio/fake-audio-provider';
import { createCallRecorder } from '@/layers/testing/call-recorder';

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
      idGenerator: createIdGenerator(),
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
      idGenerator: createIdGenerator(),
      sessionId: 'session-1',
    });

    const result = await app.controller.executeCommand({ type: 'track.add' });

    expect(result.ok).toBe(true);
    expect(app.sessionStore.getState().trackOrder).toEqual(['track-1']);
    expect(recorder.getCalls('createTrack').map(c => c.args)).toEqual([
      ['track-1'],
    ]);
  });

  it('uses FakeAudioProvider by default when none is provided', async () => {
    const app = createApp({
      idGenerator: createIdGenerator(),
      sessionId: 'session-1',
    });

    const result = await app.controller.executeCommand({ type: 'track.add' });

    expect(result.ok).toBe(true);
  });

  it('disposes cleanly', () => {
    const app = createApp({
      audioProvider: new FakeAudioProvider(),
      idGenerator: createIdGenerator(),
      sessionId: 'session-1',
    });

    expect(() => app.dispose()).not.toThrow();
  });
});

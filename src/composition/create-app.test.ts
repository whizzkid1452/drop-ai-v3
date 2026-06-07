import { describe, expect, it } from 'vitest';
import { composeApp, createApp } from './create-app';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createEmptySession } from '@/session/session-state';
import { createSessionStore } from '@/session/session-store';
import { createCallRecorder } from '@/testing/call-recorder';

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
      audioEngine: new FakeAudioEngine(),
      idGenerator: createIdGenerator(),
      sessionId: 'session-1',
    });

    expect(app.controller).toBeDefined();
    expect(app.controller.executeCommand).toBeInstanceOf(Function);
    expect(app.sessionReader.getState().id).toBe('session-1');
    expect('audioEngine' in app).toBe(false);
    expect('sessionStore' in app).toBe(false);
    expect('applyOperation' in app.sessionReader).toBe(false);
  });

  it('routes track.add through the wired controllers', async () => {
    const recorder = createCallRecorder();
    const app = createApp({
      audioEngine: new FakeAudioEngine({ recorder }),
      idGenerator: createIdGenerator(),
      sessionId: 'session-1',
    });

    const result = await app.controller.executeCommand({ type: 'track.add' });

    expect(result.ok).toBe(true);
    expect(app.sessionReader.getState().trackOrder).toEqual(['track-1']);
    expect(recorder.getCalls('createTrack').map((c) => c.args)).toEqual([
      ['track-1'],
    ]);
  });

  it('uses FakeAudioEngine by default when none is provided', async () => {
    const app = createApp({
      idGenerator: createIdGenerator(),
      sessionId: 'session-1',
    });

    const result = await app.controller.executeCommand({ type: 'track.add' });

    expect(result.ok).toBe(true);
  });

  it('disposes cleanly', () => {
    const app = createApp({
      audioEngine: new FakeAudioEngine(),
      idGenerator: createIdGenerator(),
      sessionId: 'session-1',
    });

    expect(() => app.dispose()).not.toThrow();
  });

  it('composes already-created dependencies without exposing writable internals', async () => {
    const sessionStore = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const recorder = createCallRecorder();
    const app = composeApp({
      sessionStore,
      audioEngine: new FakeAudioEngine({ recorder }),
      idGenerator: createIdGenerator(),
    });

    const result = await app.controller.executeCommand({ type: 'track.add' });

    expect(result.ok).toBe(true);
    expect(app.sessionReader.getState().trackOrder).toEqual(['track-1']);
    expect(recorder.getCalls('createTrack')).toHaveLength(1);
  });
});

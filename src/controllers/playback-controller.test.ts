import { beforeEach, describe, expect, it } from 'vitest';
import { PlaybackController } from './playback-controller';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import {
  createSessionStore,
  type ISessionStore,
} from '@/session/session-store';
import { createEmptySession } from '@/session/session-state';
import { createCallRecorder } from '@/testing/call-recorder';

interface Harness {
  store: ISessionStore;
  audio: FakeAudioEngine;
  recorder: ReturnType<typeof createCallRecorder>;
  controller: PlaybackController;
}

function setup(): Harness {
  const store = createSessionStore({
    initialSession: createEmptySession({ id: 'session-1' }),
  });
  const recorder = createCallRecorder();
  const audio = new FakeAudioEngine({ recorder });
  const controller = new PlaybackController({
    sessionStore: store,
    audioEngine: audio,
  });
  return { store, audio, recorder, controller };
}

describe('PlaybackController', () => {
  let h: Harness;
  beforeEach(() => {
    h = setup();
  });

  it('handlePlay sets playback.playing true and calls audio.play', async () => {
    await h.controller.handlePlay();

    expect(h.store.getState().playback.playing).toBe(true);
    expect(h.recorder.getCalls('play')).toHaveLength(1);
  });

  it('handlePlay leaves playback.playing false when audio.play fails', async () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      async play(): Promise<void> {
        throw new Error('play failed');
      }
    })();
    const controller = new PlaybackController({
      sessionStore: store,
      audioEngine: audio,
    });

    await expect(controller.handlePlay()).rejects.toThrow('play failed');
    expect(store.getState().playback.playing).toBe(false);
  });

  it('handlePause clears playing and calls audio.pause', async () => {
    await h.controller.handlePlay();
    h.recorder.reset();

    h.controller.handlePause();

    expect(h.store.getState().playback.playing).toBe(false);
    expect(h.recorder.getCalls('pause')).toHaveLength(1);
  });

  it('handlePause leaves playing true when audio.pause fails', async () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      pause(): void {
        throw new Error('pause failed');
      }
    })();
    const controller = new PlaybackController({
      sessionStore: store,
      audioEngine: audio,
    });
    await controller.handlePlay();

    expect(() => controller.handlePause()).toThrow('pause failed');
    expect(store.getState().playback.playing).toBe(true);
  });

  it('handleStop sets playing false, position 0, and calls audio.stop', async () => {
    await h.controller.handlePlay();
    h.controller.handleSeek(5);
    h.recorder.reset();

    h.controller.handleStop();

    const playback = h.store.getState().playback;
    expect(playback.playing).toBe(false);
    expect(playback.positionSeconds).toBe(0);
    expect(h.recorder.getCalls('stop')).toHaveLength(1);
  });

  it('handleStop leaves the session unchanged when audio.stop fails', async () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      stop(): void {
        throw new Error('stop failed');
      }
    })();
    const controller = new PlaybackController({
      sessionStore: store,
      audioEngine: audio,
    });
    await controller.handlePlay();
    controller.handleSeek(5);

    expect(() => controller.handleStop()).toThrow('stop failed');
    const playback = store.getState().playback;
    expect(playback.playing).toBe(true);
    expect(playback.positionSeconds).toBe(5);
  });

  it('handleSeek updates session position and audio position', () => {
    h.controller.handleSeek(3.5);

    expect(h.store.getState().playback.positionSeconds).toBe(3.5);
    expect(h.recorder.getCalls('seek')[0].args).toEqual([3.5]);
  });

  it('handleSeek leaves the position unchanged when audio.seek fails', () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      seek(): void {
        throw new Error('seek failed');
      }
    })();
    const controller = new PlaybackController({
      sessionStore: store,
      audioEngine: audio,
    });
    const positionBefore = store.getState().playback.positionSeconds;

    expect(() => controller.handleSeek(3.5)).toThrow('seek failed');
    expect(store.getState().playback.positionSeconds).toBe(positionBefore);
  });

  it('handleLoop updates session and audio', () => {
    h.controller.handleLoop({ start: 1, end: 5, enabled: true });

    expect(h.store.getState().playback.loop).toEqual({
      start: 1,
      end: 5,
      enabled: true,
    });
    expect(h.recorder.getCalls('setLoop')[0].args).toEqual([
      { start: 1, end: 5, enabled: true },
    ]);
  });

  it('handleLoop leaves the session unchanged when audio.setLoop fails', () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      setLoop(): void {
        throw new Error('setLoop failed');
      }
    })();
    const controller = new PlaybackController({
      sessionStore: store,
      audioEngine: audio,
    });

    expect(() =>
      controller.handleLoop({ start: 1, end: 5, enabled: true })
    ).toThrow('setLoop failed');
    expect(store.getState().playback.loop).toEqual({
      start: 0,
      end: 4,
      enabled: false,
    });
  });

  it('handleLoop validates the session before calling audio', () => {
    expect(() =>
      h.controller.handleLoop({ start: 5, end: 1, enabled: true })
    ).toThrow('Loop end must be greater than start');

    expect(h.recorder.getCalls('setLoop')).toHaveLength(0);
    expect(h.store.getState().playback.loop).toEqual({
      start: 0,
      end: 4,
      enabled: false,
    });
  });

  it('handleBpm updates session and audio', () => {
    h.controller.handleBpm(140);

    expect(h.store.getState().playback.bpm).toBe(140);
    expect(h.recorder.getCalls('setBpm')[0].args).toEqual([140]);
  });

  it('handleBpm leaves the session unchanged when audio.setBpm fails', () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      setBpm(): void {
        throw new Error('setBpm failed');
      }
    })();
    const controller = new PlaybackController({
      sessionStore: store,
      audioEngine: audio,
    });

    expect(() => controller.handleBpm(140)).toThrow('setBpm failed');
    expect(store.getState().playback.bpm).toBe(120);
  });

  it('handleBpm validates the session before calling audio', () => {
    expect(() => h.controller.handleBpm(0)).toThrow('Bpm must be positive');

    expect(h.recorder.getCalls('setBpm')).toHaveLength(0);
    expect(h.store.getState().playback.bpm).toBe(120);
  });

  it('handleMasterVolume updates session and audio', () => {
    h.controller.handleMasterVolume(0.6);

    expect(h.store.getState().playback.masterVolume).toBe(0.6);
    expect(h.recorder.getCalls('setMasterVolume')[0].args).toEqual([0.6]);
  });

  it('handleMasterVolume leaves the session unchanged when audio.setMasterVolume fails', () => {
    const store = createSessionStore({
      initialSession: createEmptySession({ id: 'session-1' }),
    });
    const audio = new (class extends FakeAudioEngine {
      setMasterVolume(): void {
        throw new Error('setMasterVolume failed');
      }
    })();
    const controller = new PlaybackController({
      sessionStore: store,
      audioEngine: audio,
    });

    expect(() => controller.handleMasterVolume(0.6)).toThrow(
      'setMasterVolume failed'
    );
    expect(store.getState().playback.masterVolume).toBe(1);
  });

  it('handleMasterVolume validates the session before calling audio', () => {
    expect(() => h.controller.handleMasterVolume(2)).toThrow(
      'Master volume must be in [0, 1]'
    );

    expect(h.recorder.getCalls('setMasterVolume')).toHaveLength(0);
    expect(h.store.getState().playback.masterVolume).toBe(1);
  });
});

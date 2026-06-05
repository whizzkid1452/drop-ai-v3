import { beforeEach, describe, expect, it } from 'vitest';
import { PlaybackController } from './playback-controller';
import { FakeAudioEngine } from '@/layers/audio-engine/fake-audio-engine';
import {
  createSessionStore,
  type ISessionStore,
} from '@/layers/session/session-store';
import { createEmptySession } from '@/layers/session/session-state';
import { createCallRecorder } from '@/layers/testing/call-recorder';

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

  it('handlePause clears playing and calls audio.pause', async () => {
    await h.controller.handlePlay();
    h.recorder.reset();

    h.controller.handlePause();

    expect(h.store.getState().playback.playing).toBe(false);
    expect(h.recorder.getCalls('pause')).toHaveLength(1);
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

  it('handleSeek updates session position and audio position', () => {
    h.controller.handleSeek(3.5);

    expect(h.store.getState().playback.positionSeconds).toBe(3.5);
    expect(h.recorder.getCalls('seek')[0].args).toEqual([3.5]);
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

  it('handleBpm updates session and audio', () => {
    h.controller.handleBpm(140);

    expect(h.store.getState().playback.bpm).toBe(140);
    expect(h.recorder.getCalls('setBpm')[0].args).toEqual([140]);
  });

  it('handleMasterVolume updates session and audio', () => {
    h.controller.handleMasterVolume(0.6);

    expect(h.store.getState().playback.masterVolume).toBe(0.6);
    expect(h.recorder.getCalls('setMasterVolume')[0].args).toEqual([0.6]);
  });
});

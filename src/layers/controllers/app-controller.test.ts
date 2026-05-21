import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from './app-controller';
import type {
  PlaybackCommandTarget,
  SessionPersistenceCommandTarget,
  TrackCommandTarget,
} from './command-controller';

describe('AppController', () => {
  let playbackController: PlaybackCommandTarget;
  let trackController: TrackCommandTarget;
  let sessionPersistenceController: SessionPersistenceCommandTarget;

  beforeEach(() => {
    playbackController = {
      handlePlay: vi.fn().mockResolvedValue(undefined),
      handlePause: vi.fn(),
      handleStop: vi.fn(),
      handleSeek: vi.fn(),
      handleLoop: vi.fn(),
      handleBpm: vi.fn(),
      handleMasterVolume: vi.fn(),
    };

    trackController = {
      addTrack: vi.fn().mockResolvedValue({ id: 'track-1' }),
      removeTrack: vi.fn(),
      setTrackVolume: vi.fn(),
      setTrackMute: vi.fn(),
      setTrackSolo: vi.fn(),
      setTrackPan: vi.fn(),
      addRegionFromAsset: vi.fn().mockResolvedValue({ id: 'region-1' }),
      moveRegion: vi.fn(),
      splitRegion: vi.fn().mockReturnValue({
        leftId: 'region-1',
        rightId: 'region-2',
      }),
      resizeRegion: vi.fn(),
      removeRegion: vi.fn(),
    };

    sessionPersistenceController = {
      saveSession: vi.fn().mockResolvedValue(undefined),
      restoreSession: vi.fn().mockResolvedValue(undefined),
      exportSession: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('keeps app dependencies behind the controller facade', () => {
    const appController = new AppController({
      playbackController,
      trackController,
      sessionPersistenceController,
    });

    expect(appController.playback).toBe(playbackController);
    expect(appController.track).toBe(trackController);
    expect(appController.sessionPersistence).toBe(
      sessionPersistenceController
    );
  });

  it('executes commands through the unified command entry point', async () => {
    const appController = new AppController({
      playbackController,
      trackController,
      sessionPersistenceController,
    });

    const result = await appController.executeCommand({ type: 'track.add' });

    expect(result).toEqual({
      ok: true,
      command: { type: 'track.add' },
      data: { id: 'track-1' },
    });
    expect(trackController.addTrack).toHaveBeenCalledTimes(1);
  });

  it('blocks invalid commands before they reach app dependencies', async () => {
    const appController = new AppController({
      playbackController,
      trackController,
      sessionPersistenceController,
    });

    const result = await appController.executeCommand({
      type: 'playback.seek',
      payload: { seconds: -1 },
    });

    expect(result.ok).toBe(false);
    expect(playbackController.handleSeek).not.toHaveBeenCalled();
  });
});

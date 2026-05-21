import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CommandController,
  type PlaybackCommandTarget,
  type SessionPersistenceCommandTarget,
  type TrackCommandTarget,
} from './command-controller';

describe('CommandController', () => {
  let playbackController: PlaybackCommandTarget;
  let trackController: TrackCommandTarget;
  let sessionPersistenceController: SessionPersistenceCommandTarget;
  let commandController: CommandController;

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

    commandController = new CommandController(
      playbackController,
      trackController,
      sessionPersistenceController
    );
  });

  it('rejects invalid commands before controller dispatch', async () => {
    const result = await commandController.execute({
      type: 'track.volume.set',
      payload: { trackId: 'track-1', volume: 2 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMMAND_VALIDATION_FAILED');
    }
    expect(trackController.setTrackVolume).not.toHaveBeenCalled();
    expect(playbackController.handlePlay).not.toHaveBeenCalled();
  });

  it('dispatches playback commands to PlaybackController methods', async () => {
    await commandController.execute({ type: 'playback.play' });
    await commandController.execute({
      type: 'playback.seek',
      payload: { seconds: 3.5 },
    });
    await commandController.execute({
      type: 'playback.loop.set',
      payload: { start: 1, end: 4, enabled: true },
    });
    await commandController.execute({
      type: 'playback.bpm.set',
      payload: { bpm: 128 },
    });
    await commandController.execute({
      type: 'playback.masterVolume.set',
      payload: { volume: 0.7 },
    });

    expect(playbackController.handlePlay).toHaveBeenCalledTimes(1);
    expect(playbackController.handleSeek).toHaveBeenCalledWith(3.5);
    expect(playbackController.handleLoop).toHaveBeenCalledWith(1, 4, true);
    expect(playbackController.handleBpm).toHaveBeenCalledWith(128);
    expect(playbackController.handleMasterVolume).toHaveBeenCalledWith(0.7);
  });

  it('dispatches track commands to TrackController methods', async () => {
    const addResult = await commandController.execute({ type: 'track.add' });
    await commandController.execute({
      type: 'track.volume.set',
      payload: { trackId: 'track-1', volume: 0.5 },
    });
    await commandController.execute({
      type: 'track.mute.set',
      payload: { trackId: 'track-1', muted: true },
    });
    await commandController.execute({
      type: 'track.solo.set',
      payload: { trackId: 'track-1', soloed: true },
    });
    await commandController.execute({
      type: 'track.pan.set',
      payload: { trackId: 'track-1', pan: -0.25 },
    });
    await commandController.execute({
      type: 'track.remove',
      payload: { trackId: 'track-1' },
    });

    expect(addResult).toEqual({
      ok: true,
      command: { type: 'track.add' },
      data: { id: 'track-1' },
    });
    expect(trackController.addTrack).toHaveBeenCalledTimes(1);
    expect(trackController.setTrackVolume).toHaveBeenCalledWith(
      'track-1',
      0.5
    );
    expect(trackController.setTrackMute).toHaveBeenCalledWith('track-1', true);
    expect(trackController.setTrackSolo).toHaveBeenCalledWith('track-1', true);
    expect(trackController.setTrackPan).toHaveBeenCalledWith('track-1', -0.25);
    expect(trackController.removeTrack).toHaveBeenCalledWith('track-1');
  });

  it('dispatches region commands to TrackController region methods', async () => {
    await commandController.execute({
      type: 'region.add',
      payload: { trackId: 'track-1', assetId: 'asset-1', startTime: 0 },
    });
    await commandController.execute({
      type: 'region.move',
      payload: { trackId: 'track-1', regionId: 'region-1', startTime: 8 },
    });
    const splitResult = await commandController.execute({
      type: 'region.split',
      payload: { trackId: 'track-1', regionId: 'region-1', splitTime: 2 },
    });
    await commandController.execute({
      type: 'region.resize',
      payload: { trackId: 'track-1', regionId: 'region-1', duration: 4 },
    });
    await commandController.execute({
      type: 'region.remove',
      payload: { trackId: 'track-1', regionId: 'region-1' },
    });

    expect(trackController.addRegionFromAsset).toHaveBeenCalledWith(
      'track-1',
      'asset-1',
      0
    );
    expect(trackController.moveRegion).toHaveBeenCalledWith(
      'track-1',
      'region-1',
      8
    );
    expect(splitResult).toEqual({
      ok: true,
      command: {
        type: 'region.split',
        payload: { trackId: 'track-1', regionId: 'region-1', splitTime: 2 },
      },
      data: { leftId: 'region-1', rightId: 'region-2' },
    });
    expect(trackController.resizeRegion).toHaveBeenCalledWith(
      'track-1',
      'region-1',
      4
    );
    expect(trackController.removeRegion).toHaveBeenCalledWith(
      'track-1',
      'region-1'
    );
  });

  it('dispatches session commands to SessionPersistenceController methods', async () => {
    await commandController.execute({ type: 'session.save' });
    await commandController.execute({ type: 'session.restore' });
    await commandController.execute({
      type: 'session.export',
      payload: { filename: 'mix.wav' },
    });

    expect(sessionPersistenceController.saveSession).toHaveBeenCalledTimes(1);
    expect(sessionPersistenceController.restoreSession).toHaveBeenCalledTimes(
      1
    );
    expect(sessionPersistenceController.exportSession).toHaveBeenCalledWith(
      'mix.wav'
    );
  });

  it('returns an execution failure when a target controller throws', async () => {
    vi.mocked(trackController.removeTrack).mockImplementation(() => {
      throw new Error('Track not found.');
    });

    const result = await commandController.execute({
      type: 'track.remove',
      payload: { trackId: 'missing-track' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({
        code: 'COMMAND_EXECUTION_FAILED',
        message: 'Track not found.',
      });
    }
  });
});

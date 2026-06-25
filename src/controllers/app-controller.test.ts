import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from './app-controller';
import type {
  AssetCommandTarget,
  ExportRangeCommandTarget,
  PlaybackCommandTarget,
  SessionExportCommandTarget,
  TrackCommandTarget,
} from './command-controller';

describe('AppController', () => {
  let playbackController: PlaybackCommandTarget;
  let assetController: AssetCommandTarget;
  let exportRangeController: ExportRangeCommandTarget;
  let trackController: TrackCommandTarget;
  let sessionExportController: SessionExportCommandTarget;

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

    assetController = {
      registerFileAsset: vi.fn().mockResolvedValue({
        id: 'asset-1',
        duration: 4,
      }),
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

    sessionExportController = {
      exportSession: vi.fn().mockResolvedValue(undefined),
    };

    exportRangeController = {
      exportRange: vi.fn().mockResolvedValue(undefined),
      previewExportRange: vi.fn().mockResolvedValue(undefined),
      setExportRangeEnd: vi.fn(),
      setExportRangeFadeIn: vi.fn(),
      setExportRangeFadeOut: vi.fn(),
      setExportRangeStart: vi.fn(),
    };
  });

  it('exposes only the unified command entry point', () => {
    const appController = new AppController({
      playbackController,
      assetController,
      exportRangeController,
      trackController,
      sessionExportController,
    });

    expect('executeCommand' in appController).toBe(true);
    expect('command' in appController).toBe(false);
    expect('playback' in appController).toBe(false);
    expect('track' in appController).toBe(false);
    expect('sessionExport' in appController).toBe(false);
  });

  it('executes commands through the unified command entry point', async () => {
    const appController = new AppController({
      playbackController,
      assetController,
      exportRangeController,
      trackController,
      sessionExportController,
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
      assetController,
      exportRangeController,
      trackController,
      sessionExportController,
    });

    const result = await appController.executeCommand({
      type: 'playback.seek',
      payload: { seconds: -1 },
    });

    expect(result.ok).toBe(false);
    expect(playbackController.handleSeek).not.toHaveBeenCalled();
  });
});

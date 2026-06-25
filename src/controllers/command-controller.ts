import { commandSchema, type AppCommand } from './command.schema';
import type {
  AssetRegisterResult,
  CommandDataFor,
  CommandResult,
  RegionAddResult,
  RegionSplitResult,
  SessionExportResult,
  TrackAddResult,
} from './command-result';

export interface PlaybackCommandTarget {
  handlePlay(): Promise<void>;
  handlePause(): void;
  handleStop(): void;
  handleSeek(seconds: number): void;
  handleLoop(input: PlaybackLoopInput): void;
  handleBpm(bpm: number): void;
  handleMasterVolume(volume: number): void;
}

export interface PlaybackLoopInput {
  start: number;
  end: number;
  enabled: boolean;
}

export interface AssetCommandTarget {
  registerFileAsset(file: File): Promise<AssetRegisterResult>;
}

export interface AddRegionFromAssetInput {
  trackId: string;
  assetId: string;
  startTime: number;
}

export interface MoveRegionInput {
  trackId: string;
  regionId: string;
  startTime: number;
}

export interface SplitRegionInput {
  trackId: string;
  regionId: string;
  splitTime: number;
}

export interface ResizeRegionInput {
  trackId: string;
  regionId: string;
  duration: number;
}

export interface TrackCommandTarget {
  addTrack(): Promise<TrackAddResult>;
  removeTrack(trackId: string): void;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackMute(trackId: string, muted: boolean): void;
  setTrackSolo(trackId: string, soloed: boolean): void;
  setTrackPan(trackId: string, pan: number): void;
  addRegionFromAsset(input: AddRegionFromAssetInput): Promise<RegionAddResult>;
  moveRegion(input: MoveRegionInput): void;
  splitRegion(input: SplitRegionInput): RegionSplitResult;
  resizeRegion(input: ResizeRegionInput): void;
  removeRegion(trackId: string, regionId: string): void;
}

export interface SessionExportCommandTarget {
  exportSession(filename?: string): Promise<SessionExportResult>;
}

export interface ExportRangeCommandTarget {
  exportRange(filename?: string): Promise<SessionExportResult>;
  previewExportRange(): Promise<void>;
  setExportRangeEnd(seconds: number): void;
  setExportRangeFadeIn(seconds: number): void;
  setExportRangeFadeOut(seconds: number): void;
  setExportRangeStart(seconds: number): void;
}

export interface CommandControllerDependencies {
  playbackController: PlaybackCommandTarget;
  assetController: AssetCommandTarget;
  exportRangeController: ExportRangeCommandTarget;
  trackController: TrackCommandTarget;
  sessionExportController: SessionExportCommandTarget;
}

export class CommandController {
  private readonly playbackController: PlaybackCommandTarget;
  private readonly assetController: AssetCommandTarget;
  private readonly exportRangeController: ExportRangeCommandTarget;
  private readonly trackController: TrackCommandTarget;
  private readonly sessionExportController: SessionExportCommandTarget;

  constructor({
    playbackController,
    assetController,
    exportRangeController,
    trackController,
    sessionExportController,
  }: CommandControllerDependencies) {
    this.playbackController = playbackController;
    this.assetController = assetController;
    this.exportRangeController = exportRangeController;
    this.trackController = trackController;
    this.sessionExportController = sessionExportController;
  }

  public async execute<TCommand extends AppCommand>(
    rawCommand: TCommand
  ): Promise<CommandResult<TCommand>>;
  public async execute(rawCommand: unknown): Promise<CommandResult>;
  public async execute(rawCommand: unknown): Promise<CommandResult> {
    const parseResult = commandSchema.safeParse(rawCommand);

    if (!parseResult.success) {
      return {
        ok: false,
        error: {
          code: 'COMMAND_VALIDATION_FAILED',
          message: 'Command payload is invalid.',
          cause: parseResult.error.issues,
        },
      };
    }

    try {
      const data = await this.dispatch(parseResult.data);
      return { ok: true, command: parseResult.data, data };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'COMMAND_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'Command failed.',
          cause: error,
        },
      };
    }
  }

  private async dispatch(
    command: AppCommand
  ): Promise<CommandDataFor<AppCommand>> {
    switch (command.type) {
      case 'playback.play':
        await this.playbackController.handlePlay();
        return undefined;

      case 'playback.pause':
        this.playbackController.handlePause();
        return undefined;

      case 'playback.stop':
        this.playbackController.handleStop();
        return undefined;

      case 'playback.seek':
        this.playbackController.handleSeek(command.payload.seconds);
        return undefined;

      case 'playback.loop.set':
        this.playbackController.handleLoop(command.payload);
        return undefined;

      case 'playback.bpm.set':
        this.playbackController.handleBpm(command.payload.bpm);
        return undefined;

      case 'playback.masterVolume.set':
        this.playbackController.handleMasterVolume(command.payload.volume);
        return undefined;

      case 'track.add':
        return await this.trackController.addTrack();

      case 'track.remove':
        this.trackController.removeTrack(command.payload.trackId);
        return undefined;

      case 'track.volume.set':
        this.trackController.setTrackVolume(
          command.payload.trackId,
          command.payload.volume
        );
        return undefined;

      case 'track.mute.set':
        this.trackController.setTrackMute(
          command.payload.trackId,
          command.payload.muted
        );
        return undefined;

      case 'track.solo.set':
        this.trackController.setTrackSolo(
          command.payload.trackId,
          command.payload.soloed
        );
        return undefined;

      case 'track.pan.set':
        this.trackController.setTrackPan(
          command.payload.trackId,
          command.payload.pan
        );
        return undefined;

      case 'region.add':
        return await this.trackController.addRegionFromAsset(command.payload);

      case 'region.move':
        this.trackController.moveRegion(command.payload);
        return undefined;

      case 'region.split':
        return this.trackController.splitRegion(command.payload);

      case 'region.resize':
        this.trackController.resizeRegion(command.payload);
        return undefined;

      case 'region.remove':
        this.trackController.removeRegion(
          command.payload.trackId,
          command.payload.regionId
        );
        return undefined;

      case 'asset.register':
        return await this.assetController.registerFileAsset(
          command.payload.file
        );

      case 'session.export':
        return await this.sessionExportController.exportSession(
          command.payload?.filename
        );

      case 'session.exportRange.start.set':
        this.exportRangeController.setExportRangeStart(command.payload.seconds);
        return undefined;

      case 'session.exportRange.end.set':
        this.exportRangeController.setExportRangeEnd(command.payload.seconds);
        return undefined;

      case 'session.exportRange.fadeIn.set':
        this.exportRangeController.setExportRangeFadeIn(
          command.payload.seconds
        );
        return undefined;

      case 'session.exportRange.fadeOut.set':
        this.exportRangeController.setExportRangeFadeOut(
          command.payload.seconds
        );
        return undefined;

      case 'session.exportRange.preview.play':
        await this.exportRangeController.previewExportRange();
        return undefined;

      case 'session.exportRange.export':
        return await this.exportRangeController.exportRange(
          command.payload?.filename
        );

      default:
        return assertNever(command);
    }
  }
}

function assertNever(command: never): never {
  throw new Error(`Unhandled command: ${JSON.stringify(command)}`);
}

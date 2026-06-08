import type { AppCommand } from './command.schema';

export interface TrackAddResult {
  id: string;
}

export interface RegionAddResult {
  id: string;
}

export interface RegionSplitResult {
  leftId: string;
  rightId: string;
}

export interface AssetRegisterResult {
  id: string;
  duration: number;
}

export interface SessionExportResult {
  blob: Blob;
  filename: string;
}

export interface CommandDataByType {
  'playback.play': undefined;
  'playback.pause': undefined;
  'playback.stop': undefined;
  'playback.seek': undefined;
  'playback.loop.set': undefined;
  'playback.bpm.set': undefined;
  'playback.masterVolume.set': undefined;
  'track.add': TrackAddResult;
  'track.remove': undefined;
  'track.volume.set': undefined;
  'track.mute.set': undefined;
  'track.solo.set': undefined;
  'track.pan.set': undefined;
  'region.add': RegionAddResult;
  'region.move': undefined;
  'region.split': RegionSplitResult;
  'region.resize': undefined;
  'region.remove': undefined;
  'asset.register': AssetRegisterResult;
  'session.export': SessionExportResult;
}

export type CommandDataFor<TCommand extends AppCommand> =
  CommandDataByType[TCommand['type']];

export type CommandErrorCode =
  | 'COMMAND_VALIDATION_FAILED'
  | 'COMMAND_EXECUTION_FAILED';

export interface CommandError {
  code: CommandErrorCode;
  message: string;
  cause?: unknown;
}

export interface CommandSuccess<TCommand extends AppCommand = AppCommand> {
  ok: true;
  command: TCommand;
  data: CommandDataFor<TCommand>;
}

export type CommandResult<TCommand extends AppCommand = AppCommand> =
  | CommandSuccess<TCommand>
  | {
      ok: false;
      error: CommandError;
    };

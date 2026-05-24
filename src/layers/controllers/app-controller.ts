import {
  CommandController,
  type PlaybackCommandTarget,
  type SessionExportCommandTarget,
  type TrackCommandTarget,
} from './command-controller';
import type { CommandResult } from './command-result';

export interface AppControllerDependencies {
  playbackController: PlaybackCommandTarget;
  trackController: TrackCommandTarget;
  sessionExportController: SessionExportCommandTarget;
}

export class AppController {
  public readonly playback: PlaybackCommandTarget;
  public readonly track: TrackCommandTarget;
  public readonly sessionExport: SessionExportCommandTarget;
  public readonly command: CommandController;

  constructor({
    playbackController,
    trackController,
    sessionExportController,
  }: AppControllerDependencies) {
    this.playback = playbackController;
    this.track = trackController;
    this.sessionExport = sessionExportController;
    this.command = new CommandController(
      playbackController,
      trackController,
      sessionExportController
    );
  }

  public executeCommand(rawCommand: unknown): Promise<CommandResult> {
    return this.command.execute(rawCommand);
  }
}

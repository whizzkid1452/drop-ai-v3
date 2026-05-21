import {
  CommandController,
  type PlaybackCommandTarget,
  type SessionPersistenceCommandTarget,
  type TrackCommandTarget,
} from './command-controller';
import type { CommandResult } from './command-result';

export interface AppControllerDependencies {
  playbackController: PlaybackCommandTarget;
  trackController: TrackCommandTarget;
  sessionPersistenceController: SessionPersistenceCommandTarget;
}

export class AppController {
  public readonly playback: PlaybackCommandTarget;
  public readonly track: TrackCommandTarget;
  public readonly sessionPersistence: SessionPersistenceCommandTarget;
  public readonly command: CommandController;

  constructor({
    playbackController,
    trackController,
    sessionPersistenceController,
  }: AppControllerDependencies) {
    this.playback = playbackController;
    this.track = trackController;
    this.sessionPersistence = sessionPersistenceController;
    this.command = new CommandController(
      playbackController,
      trackController,
      sessionPersistenceController
    );
  }

  public executeCommand(rawCommand: unknown): Promise<CommandResult> {
    return this.command.execute(rawCommand);
  }
}

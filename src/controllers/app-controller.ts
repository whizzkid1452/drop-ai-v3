import {
  CommandController,
  type CommandControllerDependencies,
} from './command-controller';
import type { CommandResult } from './command-result';

export type AppControllerDependencies = CommandControllerDependencies;

export class AppController {
  readonly #command: CommandController;

  constructor(dependencies: AppControllerDependencies) {
    this.#command = new CommandController(dependencies);
  }

  public executeCommand(rawCommand: unknown): Promise<CommandResult> {
    return this.#command.execute(rawCommand);
  }
}

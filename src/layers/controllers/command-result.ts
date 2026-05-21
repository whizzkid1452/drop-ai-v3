import type { AppCommand } from './command.schema';

export type CommandErrorCode =
  | 'COMMAND_VALIDATION_FAILED'
  | 'COMMAND_EXECUTION_FAILED';

export interface CommandError {
  code: CommandErrorCode;
  message: string;
  cause?: unknown;
}

export type CommandResult =
  | {
      ok: true;
      command: AppCommand;
      data?: unknown;
    }
  | {
      ok: false;
      error: CommandError;
    };

import type { AppController } from '@/controllers';
import type { CommandResult } from '@/controllers';
import {
  runLocalCommand,
  type CliLocalCommandDependencies,
  type CliLocalResult,
} from './cli-local-command';
import { parseCliInput } from './cli-parser';

export type { CliLocalResult, CliUploadInfo } from './cli-local-command';

export interface RunCliDependencies extends CliLocalCommandDependencies {
  appController: AppController;
}

export type CliRunResult = CommandResult | CliLocalResult;

export async function runCli(
  input: string,
  deps: RunCliDependencies
): Promise<CliRunResult> {
  const localResult = runLocalCommand(input, deps);

  if (localResult) {
    return localResult;
  }

  const parsed = parseCliInput(input);

  if (!parsed.ok) {
    return {
      ok: false,
      error: {
        code: 'COMMAND_VALIDATION_FAILED',
        message: parsed.error,
      },
    };
  }

  return deps.appController.executeCommand(parsed.command);
}

import type { AppController } from '@/controllers';
import type { CommandResult } from '@/controllers';
import { parseCliInput } from './cli-parser';

export interface RunCliDependencies {
  appController: AppController;
}

export async function runCli(
  input: string,
  deps: RunCliDependencies
): Promise<CommandResult> {
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

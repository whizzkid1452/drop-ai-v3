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
  requestUploadFile?: () => Promise<CliUploadFileRequestResult>;
}

export type CliRunResult = CommandResult | CliLocalResult;

export type CliUploadFileRequestResult =
  | { ok: true; file: File }
  | { ok: false; message: string };

export async function runCli(
  input: string,
  deps: RunCliDependencies
): Promise<CliRunResult> {
  if (isAssetUploadInput(input)) {
    return await runAssetUpload(deps);
  }

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

function isAssetUploadInput(input: string): boolean {
  const command = input.trim();
  return command === 'asset upload' || command === 'asset register';
}

async function runAssetUpload(deps: RunCliDependencies): Promise<CliRunResult> {
  if (!deps.requestUploadFile) {
    return {
      ok: false,
      error: {
        code: 'COMMAND_VALIDATION_FAILED',
        message: 'File upload is not available.',
      },
    };
  }

  const fileResult = await deps.requestUploadFile();
  if (!fileResult.ok) {
    return {
      ok: true,
      kind: 'local',
      output: fileResult.message,
    };
  }

  return deps.appController.executeCommand({
    type: 'asset.register',
    payload: { file: fileResult.file },
  });
}

import { commandSchema } from '@/controllers';
import {
  parseRegisteredCliCommand,
  type CliParseResult,
} from './command-registry';

export type { CliParseResult } from './command-registry';

export function parseCliInput(input: string): CliParseResult {
  const tokens = input.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return failure('Command is required.');
  }

  const command = parseRegisteredCliCommand(tokens);

  if (!command.ok) {
    return command;
  }

  const validationResult = commandSchema.safeParse(command.command);

  if (!validationResult.success) {
    return failure('Command payload is invalid.');
  }

  return { ok: true, command: validationResult.data };
}

function failure(error: string): CliParseResult {
  return { ok: false, error };
}

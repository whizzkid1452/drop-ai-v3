import type { CommandResult } from '@/controllers';

export function formatCommandResult(result: CommandResult): string {
  if (!result.ok) {
    return `Error: ${result.error.message}`;
  }

  if (result.data === undefined) {
    return `OK: ${result.command.type}`;
  }

  return `OK: ${result.command.type} ${formatCommandData(result.data)}`;
}

function formatCommandData(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    return String(data);
  }

  return JSON.stringify(data);
}

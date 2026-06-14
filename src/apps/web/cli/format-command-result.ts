import type { CliRunResult } from '@/apps/cli/cli-runner';
import { getSessionExportResult } from './session-export-download';

export function formatCommandResult(result: CliRunResult): string {
  if ('kind' in result) {
    return result.output;
  }

  if (!result.ok) {
    return `Error: ${result.error.message}`;
  }

  if (result.command.type === 'session.export') {
    return formatSessionExportResult(result);
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

function formatSessionExportResult(result: CliRunResult): string {
  const exportResult = getSessionExportResult(result);

  if (!exportResult) {
    return 'OK: session.export';
  }

  return `OK: session.export filename=${exportResult.filename} size=${exportResult.blob.size} bytes`;
}

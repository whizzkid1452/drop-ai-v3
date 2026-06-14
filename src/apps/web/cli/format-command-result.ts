import type { CliRunResult } from '@/apps/cli/cli-runner';

export function formatCommandResult(result: CliRunResult): string {
  if ('kind' in result) {
    return result.output;
  }

  if (!result.ok) {
    return `Error: ${result.error.message}`;
  }

  if (result.command.type === 'session.export') {
    return formatSessionExportResult(result.data);
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

function formatSessionExportResult(data: unknown): string {
  if (!isSessionExportData(data)) {
    return 'OK: session.export';
  }

  return `OK: session.export filename=${data.filename} size=${data.blob.size} bytes`;
}

function isSessionExportData(
  data: unknown
): data is { blob: Blob; filename: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'blob' in data &&
    'filename' in data &&
    data.blob instanceof Blob &&
    typeof data.filename === 'string'
  );
}

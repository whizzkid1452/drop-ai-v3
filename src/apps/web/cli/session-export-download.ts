import type { CliRunResult } from '@/apps/cli/cli-runner';
import type { SessionExportResult } from '@/controllers';

export interface DownloadSessionExportDependencies {
  createAnchor?: () => HTMLAnchorElement;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
}

export function getSessionExportResult(
  result: CliRunResult
): SessionExportResult | undefined {
  if ('kind' in result || !result.ok) {
    return undefined;
  }

  if (
    result.command.type !== 'session.export' &&
    result.command.type !== 'session.exportRange.export'
  ) {
    return undefined;
  }

  if (!isSessionExportData(result.data)) {
    return undefined;
  }

  return result.data;
}

export function downloadSessionExportResult(
  result: CliRunResult,
  deps: DownloadSessionExportDependencies = {}
): boolean {
  const exportResult = getSessionExportResult(result);

  if (!exportResult) {
    return false;
  }

  const createObjectUrl =
    deps.createObjectUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeObjectUrl =
    deps.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url));
  const anchor = deps.createAnchor?.() ?? document.createElement('a');
  const objectUrl = createObjectUrl(exportResult.blob);

  try {
    anchor.href = objectUrl;
    anchor.download = exportResult.filename;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    return true;
  } finally {
    anchor.remove();
    revokeObjectUrl(objectUrl);
  }
}

function isSessionExportData(data: unknown): data is SessionExportResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'blob' in data &&
    'filename' in data &&
    data.blob instanceof Blob &&
    typeof data.filename === 'string'
  );
}

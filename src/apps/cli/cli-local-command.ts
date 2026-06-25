import { formatCliCommandList } from './command-registry';

export interface CliUploadInfo {
  assetId: string;
  duration: number;
  filename: string;
  regionId: string;
  trackId: string;
}

export interface CliLocalCommandDependencies {
  getStatusText?: () => string;
  uploadInfo?: CliUploadInfo;
}

export interface CliLocalResult {
  ok: true;
  kind: 'local';
  output: string;
}

export function runLocalCommand(
  input: string,
  deps: CliLocalCommandDependencies
): CliLocalResult | undefined {
  const command = input.trim();

  switch (command) {
    case 'help':
      return local(formatHelp(deps.uploadInfo));

    case 'commands':
      return local(formatCliCommandList());

    case 'status':
      return local(formatStatus(deps));

    case 'asset upload':
    case 'asset register':
      return local('File upload requires a browser file picker.');

    default:
      return undefined;
  }
}

function local(output: string): CliLocalResult {
  return { ok: true, kind: 'local', output };
}

function formatHelp(uploadInfo?: CliUploadInfo): string {
  const uploadedLines = uploadInfo
    ? [
        '',
        'Uploaded:',
        `  file: ${uploadInfo.filename}`,
        `  assetId: ${uploadInfo.assetId}`,
        `  trackId: ${uploadInfo.trackId}`,
        `  regionId: ${uploadInfo.regionId}`,
      ]
    : [];

  return [
    'Drop AI CLI',
    'Use commands to edit the current in-memory session.',
    ...uploadedLines,
    '',
    'Typical flow:',
    '  track add',
    '  asset upload',
    '  region add <trackId> <assetId> 0',
    '  region split <trackId> <regionId> <seconds>',
    '  session export mix.wav',
    '',
    'Use "commands" to list every command.',
    'Use "status" to inspect the session.',
  ].join('\n');
}

function formatStatus({
  getStatusText,
  uploadInfo,
}: CliLocalCommandDependencies): string {
  const statusText = getStatusText?.();

  if (!statusText) {
    return 'No session state is available.';
  }

  const uploaded = uploadInfo
    ? [
        '',
        `Uploaded file: ${uploadInfo.filename}`,
        `Uploaded asset: ${uploadInfo.assetId}`,
      ]
    : [];

  return [statusText, ...uploaded].join('\n');
}

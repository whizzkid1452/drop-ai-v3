import type { AppController } from '@/controllers';
import type { CommandResult } from '@/controllers';
import { parseCliInput } from './cli-parser';

export interface CliUploadInfo {
  assetId: string;
  duration: number;
  filename: string;
  regionId: string;
  trackId: string;
}

export interface RunCliDependencies {
  appController: AppController;
  getStatusText?: () => string;
  uploadInfo?: CliUploadInfo;
}

export interface CliLocalResult {
  ok: true;
  kind: 'local';
  output: string;
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

function runLocalCommand(
  input: string,
  deps: RunCliDependencies
): CliLocalResult | undefined {
  const command = input.trim();

  switch (command) {
    case 'help':
      return local(formatHelp(deps.uploadInfo));

    case 'commands':
      return local(COMMANDS_TEXT);

    case 'status':
      return local(formatStatus(deps));

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
    '  region add <trackId> <assetId> 0',
    '  region split <trackId> <regionId> <seconds>',
    '  session export mix.wav',
    '',
    'Use "commands" to list every command.',
    'Use "status" to inspect the session.',
  ].join('\n');
}

const COMMANDS_TEXT = [
  'Playback:',
  '  play',
  '  pause',
  '  stop',
  '  seek <seconds>',
  '  loop <start> <end>',
  '  loop off',
  '  bpm <value>',
  '  master <0..1>',
  '',
  'Track:',
  '  track add',
  '  track remove <trackId>',
  '  volume <trackId> <0..1>',
  '  mute <trackId> on|off',
  '  solo <trackId> on|off',
  '  pan <trackId> <-1..1>',
  '',
  'Region:',
  '  region add <trackId> <assetId> [startTime]',
  '  region move <trackId> <regionId> <startTime>',
  '  region split <trackId> <regionId> <splitTime>',
  '  region resize <trackId> <regionId> <duration>',
  '  region remove <trackId> <regionId>',
  '',
  'Session:',
  '  session export [filename]',
  '  export [filename]',
].join('\n');

function formatStatus({ getStatusText, uploadInfo }: RunCliDependencies) {
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

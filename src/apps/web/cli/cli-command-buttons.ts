import {
  cliCommandRegistry,
  type CliCommandGroup,
  type CliCommandUsage,
} from '@/apps/cli/command-registry';
import type { UploadedSessionInfo } from '../upload/upload-session-flow';

export type CliCommandButtonGroup = CliCommandGroup | 'Local';

export interface CliCommandButtonDefinition {
  commandInput: string;
  group: CliCommandButtonGroup;
  label: string;
  usage: string;
}

interface LocalCommandButtonDefinition {
  commandInput: string;
  label: string;
}

const LOCAL_COMMANDS: readonly LocalCommandButtonDefinition[] = [
  { commandInput: 'help', label: 'help' },
  { commandInput: 'commands', label: 'commands' },
  { commandInput: 'status', label: 'status' },
];

const commandInputByUsage: Record<
  CliCommandUsage,
  (uploadInfo: UploadedSessionInfo) => string
> = {
  play: () => 'play',
  pause: () => 'pause',
  stop: () => 'stop',
  'seek <seconds>': () => 'seek 1',
  'loop off': () => 'loop off',
  'loop <start> <end>': (uploadInfo) =>
    `loop 0 ${formatPositiveTime(uploadInfo.duration)}`,
  'bpm <value>': () => 'bpm 120',
  'master <0..1>': () => 'master 0.8',
  'track add': () => 'track add',
  'track remove <trackId>': (uploadInfo) =>
    `track remove ${uploadInfo.trackId}`,
  'volume <trackId> <0..1>': (uploadInfo) => `volume ${uploadInfo.trackId} 0.8`,
  'mute <trackId> on|off': (uploadInfo) => `mute ${uploadInfo.trackId} on`,
  'solo <trackId> on|off': (uploadInfo) => `solo ${uploadInfo.trackId} on`,
  'pan <trackId> <-1..1>': (uploadInfo) => `pan ${uploadInfo.trackId} 0`,
  'region add <trackId> <assetId> [startTime]': (uploadInfo) =>
    `region add ${uploadInfo.trackId} ${uploadInfo.assetId} 0`,
  'region move <trackId> <regionId> <startTime>': (uploadInfo) =>
    `region move ${uploadInfo.trackId} ${uploadInfo.regionId} 1`,
  'region split <trackId> <regionId> <splitTime>': (uploadInfo) =>
    `region split ${uploadInfo.trackId} ${uploadInfo.regionId} ${formatInsideRegionTime(uploadInfo.duration)}`,
  'region resize <trackId> <regionId> <duration>': (uploadInfo) =>
    `region resize ${uploadInfo.trackId} ${uploadInfo.regionId} ${formatPositiveTime(uploadInfo.duration / 2)}`,
  'region remove <trackId> <regionId>': (uploadInfo) =>
    `region remove ${uploadInfo.trackId} ${uploadInfo.regionId}`,
  'session export [filename]': (uploadInfo) =>
    `session export ${createExportFilename(uploadInfo.filename)}`,
  'export [filename]': (uploadInfo) =>
    `export ${createExportFilename(uploadInfo.filename)}`,
};

const COMMAND_GROUPS: readonly CliCommandButtonGroup[] = [
  'Local',
  'Playback',
  'Track',
  'Region',
  'Session',
];

export function createCliCommandButtons(
  uploadInfo: UploadedSessionInfo
): CliCommandButtonDefinition[] {
  return [
    ...LOCAL_COMMANDS.map((command) => ({
      commandInput: command.commandInput,
      group: 'Local' as const,
      label: command.label,
      usage: command.commandInput,
    })),
    ...cliCommandRegistry.map((definition) => {
      const commandInput = commandInputByUsage[definition.usage](uploadInfo);

      return {
        commandInput,
        group: definition.group,
        label: commandInput,
        usage: definition.usage,
      };
    }),
  ];
}

export function groupCliCommandButtons(
  buttons: readonly CliCommandButtonDefinition[]
): Array<{
  commands: CliCommandButtonDefinition[];
  group: CliCommandButtonGroup;
}> {
  return COMMAND_GROUPS.map((group) => ({
    commands: buttons.filter((button) => button.group === group),
    group,
  })).filter((buttonGroup) => buttonGroup.commands.length > 0);
}

function createExportFilename(filename: string): string {
  const basename = filename.replace(/\.[^.]*$/, '');
  return `${basename || 'session'}.wav`;
}

function formatInsideRegionTime(duration: number): string {
  if (!Number.isFinite(duration) || duration <= 0) {
    return '0.5';
  }

  return formatPositiveTime(duration / 2);
}

function formatPositiveTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '1';
  }

  return Number(value.toFixed(3)).toString();
}

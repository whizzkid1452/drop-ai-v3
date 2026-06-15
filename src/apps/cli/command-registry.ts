import type { AppCommand } from '@/controllers';

export type CliParseResult =
  | {
      ok: true;
      command: AppCommand;
    }
  | {
      ok: false;
      error: string;
    };

export type CliCommandGroup = 'Playback' | 'Track' | 'Region' | 'Session';

export interface CliCommandDefinition {
  description: string;
  group: CliCommandGroup;
  matches: (tokens: string[]) => boolean;
  parse: (tokens: string[]) => CliParseResult;
  usage: string;
}

const CLI_COMMAND_GROUPS: CliCommandGroup[] = [
  'Playback',
  'Track',
  'Region',
  'Session',
];

export const cliCommandRegistry = [
  command({
    group: 'Playback',
    usage: 'play',
    description: 'Start playback.',
    prefix: ['play'],
    parse: () => success({ type: 'playback.play' }),
  }),
  command({
    group: 'Playback',
    usage: 'pause',
    description: 'Pause playback.',
    prefix: ['pause'],
    parse: () => success({ type: 'playback.pause' }),
  }),
  command({
    group: 'Playback',
    usage: 'stop',
    description: 'Stop playback and reset the playhead.',
    prefix: ['stop'],
    parse: () => success({ type: 'playback.stop' }),
  }),
  command({
    group: 'Playback',
    usage: 'seek <seconds>',
    description: 'Move the playhead to seconds.',
    prefix: ['seek'],
    parse: parseSeek,
  }),
  command({
    group: 'Playback',
    usage: 'loop off',
    description: 'Disable loop playback.',
    prefix: ['loop', 'off'],
    parse: () =>
      success({
        type: 'playback.loop.set',
        payload: { start: 0, end: 1, enabled: false },
      }),
  }),
  command({
    group: 'Playback',
    usage: 'loop <start> <end>',
    description: 'Enable loop playback for a time range.',
    prefix: ['loop'],
    parse: parseLoop,
  }),
  command({
    group: 'Playback',
    usage: 'bpm <value>',
    description: 'Set session BPM.',
    prefix: ['bpm'],
    parse: parseBpm,
  }),
  command({
    group: 'Playback',
    usage: 'master <0..1>',
    description: 'Set master volume.',
    prefix: ['master'],
    parse: parseMasterVolume,
  }),
  command({
    group: 'Track',
    usage: 'track add',
    description: 'Create a new track.',
    prefix: ['track', 'add'],
    parse: () => success({ type: 'track.add' }),
  }),
  command({
    group: 'Track',
    usage: 'track remove <trackId>',
    description: 'Remove a track.',
    prefix: ['track', 'remove'],
    parse: parseTrackRemove,
  }),
  command({
    group: 'Track',
    usage: 'volume <trackId> <0..1>',
    description: 'Set track volume.',
    prefix: ['volume'],
    parse: parseTrackVolume,
  }),
  command({
    group: 'Track',
    usage: 'mute <trackId> on|off',
    description: 'Toggle track mute.',
    prefix: ['mute'],
    parse: parseTrackMute,
  }),
  command({
    group: 'Track',
    usage: 'solo <trackId> on|off',
    description: 'Toggle track solo.',
    prefix: ['solo'],
    parse: parseTrackSolo,
  }),
  command({
    group: 'Track',
    usage: 'pan <trackId> <-1..1>',
    description: 'Set track pan.',
    prefix: ['pan'],
    parse: parseTrackPan,
  }),
  command({
    group: 'Region',
    usage: 'region add <trackId> <assetId> [startTime]',
    description: 'Add an asset region to a track.',
    prefix: ['region', 'add'],
    parse: parseRegionAdd,
  }),
  command({
    group: 'Region',
    usage: 'region move <trackId> <regionId> <startTime>',
    description: 'Move a region to a start time.',
    prefix: ['region', 'move'],
    parse: parseRegionMove,
  }),
  command({
    group: 'Region',
    usage: 'region split <trackId> <regionId> <splitTime>',
    description: 'Split a region at a time.',
    prefix: ['region', 'split'],
    parse: parseRegionSplit,
  }),
  command({
    group: 'Region',
    usage: 'region resize <trackId> <regionId> <duration>',
    description: 'Resize a region duration.',
    prefix: ['region', 'resize'],
    parse: parseRegionResize,
  }),
  command({
    group: 'Region',
    usage: 'region remove <trackId> <regionId>',
    description: 'Remove a region from a track.',
    prefix: ['region', 'remove'],
    parse: parseRegionRemove,
  }),
  command({
    group: 'Session',
    usage: 'session export [filename]',
    description: 'Export the current session as a WAV file.',
    prefix: ['session', 'export'],
    parse: parseSessionExport,
  }),
  command({
    group: 'Session',
    usage: 'export [filename]',
    description: 'Alias for session export.',
    prefix: ['export'],
    parse: parseExportAlias,
  }),
] as const satisfies readonly CliCommandDefinition[];

export type CliCommandUsage = (typeof cliCommandRegistry)[number]['usage'];

export function parseRegisteredCliCommand(tokens: string[]): CliParseResult {
  const definition = cliCommandRegistry.find((candidate) =>
    candidate.matches(tokens)
  );

  if (definition) {
    return definition.parse(tokens);
  }

  return failure(formatUnknownCommandError(tokens));
}

export function formatCliCommandList(): string {
  return CLI_COMMAND_GROUPS.flatMap((group) => {
    const definitions = cliCommandRegistry.filter(
      (definition) => definition.group === group
    );

    return [`${group}:`, ...definitions.map(formatCommandDefinition), ''];
  })
    .slice(0, -1)
    .join('\n');
}

function command<TUsage extends string>({
  description,
  group,
  parse,
  prefix,
  usage,
}: Omit<CliCommandDefinition, 'matches'> & {
  prefix: string[];
  usage: TUsage;
}): CliCommandDefinition & { usage: TUsage } {
  return {
    description,
    group,
    matches: (tokens) => hasPrefix(tokens, prefix),
    parse,
    usage,
  };
}

function hasPrefix(tokens: string[], prefix: string[]): boolean {
  return prefix.every((token, index) => tokens[index] === token);
}

function formatCommandDefinition(definition: CliCommandDefinition): string {
  return `  ${definition.usage} - ${definition.description}`;
}

function parseSeek(tokens: string[]): CliParseResult {
  const seconds = parseRequiredNumber(tokens[1], 'seconds');

  if (!seconds.ok) {
    return seconds;
  }

  return success({
    type: 'playback.seek',
    payload: { seconds: seconds.value },
  });
}

function parseLoop(tokens: string[]): CliParseResult {
  const start = parseRequiredNumber(tokens[1], 'start');
  const end = parseRequiredNumber(tokens[2], 'end');

  if (!start.ok) {
    return start;
  }
  if (!end.ok) {
    return end;
  }

  return success({
    type: 'playback.loop.set',
    payload: { start: start.value, end: end.value, enabled: true },
  });
}

function parseBpm(tokens: string[]): CliParseResult {
  const bpm = parseRequiredNumber(tokens[1], 'bpm');

  if (!bpm.ok) {
    return bpm;
  }

  return success({
    type: 'playback.bpm.set',
    payload: { bpm: bpm.value },
  });
}

function parseMasterVolume(tokens: string[]): CliParseResult {
  const volume = parseRequiredNumber(tokens[1], 'volume');

  if (!volume.ok) {
    return volume;
  }

  return success({
    type: 'playback.masterVolume.set',
    payload: { volume: volume.value },
  });
}

function parseTrackRemove(tokens: string[]): CliParseResult {
  const trackId = tokens[2];

  if (!trackId) {
    return failure('track remove requires trackId.');
  }

  return success({
    type: 'track.remove',
    payload: { trackId },
  });
}

function parseTrackVolume(tokens: string[]): CliParseResult {
  const trackId = tokens[1];
  const volume = parseRequiredNumber(tokens[2], 'volume');

  if (!trackId) {
    return failure('volume requires trackId.');
  }
  if (!volume.ok) {
    return volume;
  }

  return success({
    type: 'track.volume.set',
    payload: { trackId, volume: volume.value },
  });
}

function parseTrackMute(tokens: string[]): CliParseResult {
  const trackId = tokens[1];
  const muted = parseOnOff(tokens[2], 'muted');

  if (!trackId) {
    return failure('mute requires trackId.');
  }
  if (!muted.ok) {
    return muted;
  }

  return success({
    type: 'track.mute.set',
    payload: { trackId, muted: muted.value },
  });
}

function parseTrackSolo(tokens: string[]): CliParseResult {
  const trackId = tokens[1];
  const soloed = parseOnOff(tokens[2], 'soloed');

  if (!trackId) {
    return failure('solo requires trackId.');
  }
  if (!soloed.ok) {
    return soloed;
  }

  return success({
    type: 'track.solo.set',
    payload: { trackId, soloed: soloed.value },
  });
}

function parseTrackPan(tokens: string[]): CliParseResult {
  const trackId = tokens[1];
  const pan = parseRequiredNumber(tokens[2], 'pan');

  if (!trackId) {
    return failure('pan requires trackId.');
  }
  if (!pan.ok) {
    return pan;
  }

  return success({
    type: 'track.pan.set',
    payload: { trackId, pan: pan.value },
  });
}

function parseRegionAdd(tokens: string[]): CliParseResult {
  const trackId = tokens[2];
  const assetId = tokens[3];
  const startTime = tokens[4] ? Number(tokens[4]) : 0;

  if (!trackId) {
    return failure('region requires trackId.');
  }
  if (!assetId) {
    return failure('region requires regionId or assetId.');
  }
  if (!Number.isFinite(startTime)) {
    return failure('startTime must be a number.');
  }

  return success({
    type: 'region.add',
    payload: { trackId, assetId, startTime },
  });
}

function parseRegionMove(tokens: string[]): CliParseResult {
  const trackId = tokens[2];
  const regionId = tokens[3];
  const startTime = parseRequiredNumber(tokens[4], 'startTime');

  if (!trackId) {
    return failure('region requires trackId.');
  }
  if (!regionId) {
    return failure('region requires regionId or assetId.');
  }
  if (!startTime.ok) {
    return startTime;
  }

  return success({
    type: 'region.move',
    payload: { trackId, regionId, startTime: startTime.value },
  });
}

function parseRegionSplit(tokens: string[]): CliParseResult {
  const trackId = tokens[2];
  const regionId = tokens[3];
  const splitTime = parseRequiredNumber(tokens[4], 'splitTime');

  if (!trackId) {
    return failure('region requires trackId.');
  }
  if (!regionId) {
    return failure('region requires regionId or assetId.');
  }
  if (!splitTime.ok) {
    return splitTime;
  }

  return success({
    type: 'region.split',
    payload: { trackId, regionId, splitTime: splitTime.value },
  });
}

function parseRegionResize(tokens: string[]): CliParseResult {
  const trackId = tokens[2];
  const regionId = tokens[3];
  const duration = parseRequiredNumber(tokens[4], 'duration');

  if (!trackId) {
    return failure('region requires trackId.');
  }
  if (!regionId) {
    return failure('region requires regionId or assetId.');
  }
  if (!duration.ok) {
    return duration;
  }

  return success({
    type: 'region.resize',
    payload: { trackId, regionId, duration: duration.value },
  });
}

function parseRegionRemove(tokens: string[]): CliParseResult {
  const trackId = tokens[2];
  const regionId = tokens[3];

  if (!trackId) {
    return failure('region requires trackId.');
  }
  if (!regionId) {
    return failure('region requires regionId or assetId.');
  }

  return success({
    type: 'region.remove',
    payload: { trackId, regionId },
  });
}

function parseSessionExport(tokens: string[]): CliParseResult {
  return success({
    type: 'session.export',
    payload:
      tokens.length > 2 ? { filename: tokens.slice(2).join(' ') } : undefined,
  });
}

function parseExportAlias(tokens: string[]): CliParseResult {
  return success({
    type: 'session.export',
    payload:
      tokens.length > 1 ? { filename: tokens.slice(1).join(' ') } : undefined,
  });
}

function parseRequiredNumber(
  rawValue: string | undefined,
  label: string
): { ok: true; value: number } | { ok: false; error: string } {
  if (!rawValue) {
    return { ok: false, error: `${label} is required.` };
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return { ok: false, error: `${label} must be a number.` };
  }

  return { ok: true, value };
}

function parseOnOff(
  rawValue: string | undefined,
  label: string
): { ok: true; value: boolean } | { ok: false; error: string } {
  if (rawValue === 'on') {
    return { ok: true, value: true };
  }
  if (rawValue === 'off') {
    return { ok: true, value: false };
  }

  return { ok: false, error: `${label} must be on or off.` };
}

function formatUnknownCommandError(tokens: string[]): string {
  const [name, subcommand] = tokens;

  if (name === 'region' && !subcommand) {
    return 'region requires subcommand.';
  }
  if (name === 'region') {
    return 'Unknown region subcommand.';
  }
  if (name === 'track') {
    return 'Unknown track subcommand.';
  }
  if (name === 'session') {
    return 'Unknown session subcommand. Use "export".';
  }

  return `Unknown command: ${name}.`;
}

function success(command: AppCommand): CliParseResult {
  return { ok: true, command };
}

function failure(error: string): CliParseResult {
  return { ok: false, error };
}

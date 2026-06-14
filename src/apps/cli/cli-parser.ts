import { commandSchema, type AppCommand } from '@/controllers';

export type CliParseResult =
  | {
      ok: true;
      command: AppCommand;
    }
  | {
      ok: false;
      error: string;
    };

export function parseCliInput(input: string): CliParseResult {
  const tokens = input.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return failure('Command is required.');
  }

  const [name, ...args] = tokens;
  const command = toCommand(name, args);

  if (!command.ok) {
    return command;
  }

  const validationResult = commandSchema.safeParse(command.command);

  if (!validationResult.success) {
    return failure('Command payload is invalid.');
  }

  return { ok: true, command: validationResult.data };
}

function toCommand(name: string, args: string[]): CliParseResult {
  switch (name) {
    case 'play':
      return success({ type: 'playback.play' });

    case 'pause':
      return success({ type: 'playback.pause' });

    case 'stop':
      return success({ type: 'playback.stop' });

    case 'seek':
      return parseSeek(args);

    case 'loop':
      return parseLoop(args);

    case 'bpm':
      return parseBpm(args);

    case 'master':
      return parseMasterVolume(args);

    case 'track':
      return parseTrack(args);

    case 'volume':
      return parseTrackVolume(args);

    case 'mute':
      return parseTrackMute(args);

    case 'solo':
      return parseTrackSolo(args);

    case 'pan':
      return parseTrackPan(args);

    case 'region':
      return parseRegion(args);

    case 'session':
      return parseSession(args);

    case 'export':
      return parseSessionExport(args);

    default:
      return failure(`Unknown command: ${name}.`);
  }
}

function parseSeek(args: string[]): CliParseResult {
  const seconds = parseRequiredNumber(args[0], 'seconds');

  if (!seconds.ok) {
    return seconds;
  }

  return success({
    type: 'playback.seek',
    payload: { seconds: seconds.value },
  });
}

function parseLoop(args: string[]): CliParseResult {
  if (args[0] === 'off') {
    return success({
      type: 'playback.loop.set',
      payload: { start: 0, end: 1, enabled: false },
    });
  }

  const start = parseRequiredNumber(args[0], 'start');
  const end = parseRequiredNumber(args[1], 'end');

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

function parseBpm(args: string[]): CliParseResult {
  const bpm = parseRequiredNumber(args[0], 'bpm');

  if (!bpm.ok) {
    return bpm;
  }

  return success({
    type: 'playback.bpm.set',
    payload: { bpm: bpm.value },
  });
}

function parseMasterVolume(args: string[]): CliParseResult {
  const volume = parseRequiredNumber(args[0], 'volume');

  if (!volume.ok) {
    return volume;
  }

  return success({
    type: 'playback.masterVolume.set',
    payload: { volume: volume.value },
  });
}

function parseTrack(args: string[]): CliParseResult {
  const [subcommand, trackId] = args;

  switch (subcommand) {
    case 'add':
      return success({ type: 'track.add' });

    case 'remove':
      if (!trackId) {
        return failure('track remove requires trackId.');
      }
      return success({
        type: 'track.remove',
        payload: { trackId },
      });

    default:
      return failure('Unknown track subcommand.');
  }
}

function parseTrackVolume(args: string[]): CliParseResult {
  const [trackId, rawVolume] = args;
  const volume = parseRequiredNumber(rawVolume, 'volume');

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

function parseTrackMute(args: string[]): CliParseResult {
  const [trackId, rawMuted] = args;
  const muted = parseOnOff(rawMuted, 'muted');

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

function parseTrackSolo(args: string[]): CliParseResult {
  const [trackId, rawSoloed] = args;
  const soloed = parseOnOff(rawSoloed, 'soloed');

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

function parseTrackPan(args: string[]): CliParseResult {
  const [trackId, rawPan] = args;
  const pan = parseRequiredNumber(rawPan, 'pan');

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

function parseRegion(args: string[]): CliParseResult {
  const [subcommand, trackId, regionOrAssetId, rawValue] = args;

  if (!subcommand) {
    return failure('region requires subcommand.');
  }
  if (!trackId) {
    return failure('region requires trackId.');
  }
  if (!regionOrAssetId) {
    return failure('region requires regionId or assetId.');
  }

  switch (subcommand) {
    case 'add':
      return parseRegionAdd(trackId, regionOrAssetId, rawValue);

    case 'move':
      return parseRegionMove(trackId, regionOrAssetId, rawValue);

    case 'split':
      return parseRegionSplit(trackId, regionOrAssetId, rawValue);

    case 'resize':
      return parseRegionResize(trackId, regionOrAssetId, rawValue);

    case 'remove':
      return success({
        type: 'region.remove',
        payload: { trackId, regionId: regionOrAssetId },
      });

    default:
      return failure('Unknown region subcommand.');
  }
}

function parseRegionAdd(
  trackId: string,
  assetId: string,
  rawStartTime?: string
): CliParseResult {
  const startTime = rawStartTime ? Number(rawStartTime) : 0;

  if (!Number.isFinite(startTime)) {
    return failure('startTime must be a number.');
  }

  return success({
    type: 'region.add',
    payload: { trackId, assetId, startTime },
  });
}

function parseRegionMove(
  trackId: string,
  regionId: string,
  rawStartTime?: string
): CliParseResult {
  const startTime = parseRequiredNumber(rawStartTime, 'startTime');

  if (!startTime.ok) {
    return startTime;
  }

  return success({
    type: 'region.move',
    payload: { trackId, regionId, startTime: startTime.value },
  });
}

function parseRegionSplit(
  trackId: string,
  regionId: string,
  rawSplitTime?: string
): CliParseResult {
  const splitTime = parseRequiredNumber(rawSplitTime, 'splitTime');

  if (!splitTime.ok) {
    return splitTime;
  }

  return success({
    type: 'region.split',
    payload: { trackId, regionId, splitTime: splitTime.value },
  });
}

function parseRegionResize(
  trackId: string,
  regionId: string,
  rawDuration?: string
): CliParseResult {
  const duration = parseRequiredNumber(rawDuration, 'duration');

  if (!duration.ok) {
    return duration;
  }

  return success({
    type: 'region.resize',
    payload: { trackId, regionId, duration: duration.value },
  });
}

function parseSession(args: string[]): CliParseResult {
  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case 'export':
      return parseSessionExport(rest);

    default:
      return failure('Unknown session subcommand. Use "export".');
  }
}

function parseSessionExport(args: string[]): CliParseResult {
  return success({
    type: 'session.export',
    payload: args.length > 0 ? { filename: args.join(' ') } : undefined,
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

function success(command: AppCommand): CliParseResult {
  return { ok: true, command };
}

function failure(error: string): CliParseResult {
  return { ok: false, error };
}

import type { AppCommand } from '@/controllers';

export type AgentCommandAvailability =
  | 'agent'
  | 'requiresUserAttachment'
  | 'disabled';

export interface AgentCommandDefinition {
  type: AppCommand['type'];
  title: string;
  description: string;
  payloadDescription: string;
  examples: AppCommand[];
  availability: AgentCommandAvailability;
}

export const agentCommandCatalog = [
  commandDefinition({
    availability: 'agent',
    description: 'Start playback from the current playhead position.',
    examples: [{ type: 'playback.play' }],
    payloadDescription: 'No payload.',
    title: 'Play',
    type: 'playback.play',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Pause playback at the current playhead position.',
    examples: [{ type: 'playback.pause' }],
    payloadDescription: 'No payload.',
    title: 'Pause',
    type: 'playback.pause',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Stop playback and reset the playhead to zero seconds.',
    examples: [{ type: 'playback.stop' }],
    payloadDescription: 'No payload.',
    title: 'Stop',
    type: 'playback.stop',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Move the playhead to an absolute time in seconds.',
    examples: [{ type: 'playback.seek', payload: { seconds: 1 } }],
    payloadDescription: '{ seconds: non-negative finite number }',
    title: 'Seek',
    type: 'playback.seek',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Set loop playback boundaries and enabled state.',
    examples: [
      {
        type: 'playback.loop.set',
        payload: { enabled: true, end: 3, start: 1 },
      },
    ],
    payloadDescription:
      '{ start: non-negative finite number, end: positive number, enabled: boolean }',
    title: 'Set Loop',
    type: 'playback.loop.set',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Set the session tempo in beats per minute.',
    examples: [{ type: 'playback.bpm.set', payload: { bpm: 120 } }],
    payloadDescription: '{ bpm: positive finite number }',
    title: 'Set BPM',
    type: 'playback.bpm.set',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Set the master output volume.',
    examples: [{ type: 'playback.masterVolume.set', payload: { volume: 0.8 } }],
    payloadDescription: '{ volume: number in [0, 1] }',
    title: 'Set Master Volume',
    type: 'playback.masterVolume.set',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Create a new audio track.',
    examples: [{ type: 'track.add' }],
    payloadDescription: 'No payload.',
    title: 'Add Track',
    type: 'track.add',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Remove an existing track by id.',
    examples: [{ type: 'track.remove', payload: { trackId: 'track-1' } }],
    payloadDescription: '{ trackId: non-empty string }',
    title: 'Remove Track',
    type: 'track.remove',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Set a track volume.',
    examples: [
      {
        type: 'track.volume.set',
        payload: { trackId: 'track-1', volume: 0.5 },
      },
    ],
    payloadDescription:
      '{ trackId: non-empty string, volume: number in [0, 1] }',
    title: 'Set Track Volume',
    type: 'track.volume.set',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Set whether a track is muted.',
    examples: [
      { type: 'track.mute.set', payload: { muted: true, trackId: 'track-1' } },
    ],
    payloadDescription: '{ trackId: non-empty string, muted: boolean }',
    title: 'Set Track Mute',
    type: 'track.mute.set',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Set whether a track is soloed.',
    examples: [
      { type: 'track.solo.set', payload: { soloed: true, trackId: 'track-1' } },
    ],
    payloadDescription: '{ trackId: non-empty string, soloed: boolean }',
    title: 'Set Track Solo',
    type: 'track.solo.set',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Set a track stereo pan value.',
    examples: [
      { type: 'track.pan.set', payload: { pan: -0.25, trackId: 'track-1' } },
    ],
    payloadDescription: '{ trackId: non-empty string, pan: number in [-1, 1] }',
    title: 'Set Track Pan',
    type: 'track.pan.set',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Add a region that references an already registered asset.',
    examples: [
      {
        type: 'region.add',
        payload: { assetId: 'asset-1', startTime: 0, trackId: 'track-1' },
      },
    ],
    payloadDescription:
      '{ trackId: non-empty string, assetId: non-empty string, startTime: non-negative finite number }',
    title: 'Add Region',
    type: 'region.add',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Move an existing region to an absolute start time.',
    examples: [
      {
        type: 'region.move',
        payload: { regionId: 'region-1', startTime: 1, trackId: 'track-1' },
      },
    ],
    payloadDescription:
      '{ trackId: non-empty string, regionId: non-empty string, startTime: non-negative finite number }',
    title: 'Move Region',
    type: 'region.move',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Split an existing region at an absolute session time.',
    examples: [
      {
        type: 'region.split',
        payload: { regionId: 'region-1', splitTime: 1, trackId: 'track-1' },
      },
    ],
    payloadDescription:
      '{ trackId: non-empty string, regionId: non-empty string, splitTime: non-negative finite number }',
    title: 'Split Region',
    type: 'region.split',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Resize an existing region duration.',
    examples: [
      {
        type: 'region.resize',
        payload: { duration: 2, regionId: 'region-1', trackId: 'track-1' },
      },
    ],
    payloadDescription:
      '{ trackId: non-empty string, regionId: non-empty string, duration: positive finite number }',
    title: 'Resize Region',
    type: 'region.resize',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Remove an existing region from a track.',
    examples: [
      {
        type: 'region.remove',
        payload: { regionId: 'region-1', trackId: 'track-1' },
      },
    ],
    payloadDescription:
      '{ trackId: non-empty string, regionId: non-empty string }',
    title: 'Remove Region',
    type: 'region.remove',
  }),
  commandDefinition({
    availability: 'requiresUserAttachment',
    description:
      'Register a user-selected audio file. The planner cannot create the File object.',
    examples: [],
    payloadDescription: '{ file: File selected by the user surface }',
    title: 'Register Asset',
    type: 'asset.register',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Export the full session as a WAV file.',
    examples: [
      { type: 'session.export', payload: { filename: 'session.wav' } },
    ],
    payloadDescription: '{ filename?: non-empty string }',
    title: 'Export Session',
    type: 'session.export',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Set the export range start time.',
    examples: [
      { type: 'session.exportRange.start.set', payload: { seconds: 1 } },
    ],
    payloadDescription: '{ seconds: non-negative finite number }',
    title: 'Set Export Range Start',
    type: 'session.exportRange.start.set',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Set the export range end time.',
    examples: [
      { type: 'session.exportRange.end.set', payload: { seconds: 3 } },
    ],
    payloadDescription: '{ seconds: non-negative finite number }',
    title: 'Set Export Range End',
    type: 'session.exportRange.end.set',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Set fade-in duration for range export.',
    examples: [
      { type: 'session.exportRange.fadeIn.set', payload: { seconds: 0.1 } },
    ],
    payloadDescription: '{ seconds: non-negative finite number }',
    title: 'Set Export Fade In',
    type: 'session.exportRange.fadeIn.set',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Set fade-out duration for range export.',
    examples: [
      { type: 'session.exportRange.fadeOut.set', payload: { seconds: 0.1 } },
    ],
    payloadDescription: '{ seconds: non-negative finite number }',
    title: 'Set Export Fade Out',
    type: 'session.exportRange.fadeOut.set',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Preview the configured export range.',
    examples: [{ type: 'session.exportRange.preview.play' }],
    payloadDescription: 'No payload.',
    title: 'Preview Export Range',
    type: 'session.exportRange.preview.play',
  }),
  commandDefinition({
    availability: 'agent',
    description: 'Export the configured range as a WAV file.',
    examples: [
      {
        type: 'session.exportRange.export',
        payload: { filename: 'clip.wav' },
      },
    ],
    payloadDescription: '{ filename?: non-empty string }',
    title: 'Export Range',
    type: 'session.exportRange.export',
  }),
] as const satisfies readonly AgentCommandDefinition[];

export function getAgentCommandDefinition(
  type: AppCommand['type']
): AgentCommandDefinition {
  const definition = agentCommandCatalog.find(
    (candidate) => candidate.type === type
  );

  if (!definition) {
    throw new Error(`Agent command definition not found: ${type}`);
  }

  return definition;
}

function commandDefinition(
  definition: AgentCommandDefinition
): AgentCommandDefinition {
  return definition;
}

import { z } from 'zod';

const idSchema = z.string().min(1);
const secondsSchema = z.number().finite().nonnegative();
const positiveNumberSchema = z.number().finite().positive();
const unitValueSchema = z.number().finite().min(0).max(1);
const panValueSchema = z.number().finite().min(-1).max(1);

const playbackPlayCommandSchema = z
  .object({
    type: z.literal('playback.play'),
  })
  .strict();

const playbackPauseCommandSchema = z
  .object({
    type: z.literal('playback.pause'),
  })
  .strict();

const playbackStopCommandSchema = z
  .object({
    type: z.literal('playback.stop'),
  })
  .strict();

const playbackSeekCommandSchema = z
  .object({
    type: z.literal('playback.seek'),
    payload: z
      .object({
        seconds: secondsSchema,
      })
      .strict(),
  })
  .strict();

const playbackLoopCommandSchema = z
  .object({
    type: z.literal('playback.loop.set'),
    payload: z
      .object({
        start: secondsSchema,
        end: positiveNumberSchema,
        enabled: z.boolean(),
      })
      .strict()
      .refine(payload => !payload.enabled || payload.end > payload.start, {
        message: 'Loop end must be greater than loop start.',
        path: ['end'],
      }),
  })
  .strict();

const playbackBpmCommandSchema = z
  .object({
    type: z.literal('playback.bpm.set'),
    payload: z
      .object({
        bpm: positiveNumberSchema,
      })
      .strict(),
  })
  .strict();

const playbackMasterVolumeCommandSchema = z
  .object({
    type: z.literal('playback.masterVolume.set'),
    payload: z
      .object({
        volume: unitValueSchema,
      })
      .strict(),
  })
  .strict();

const trackAddCommandSchema = z
  .object({
    type: z.literal('track.add'),
  })
  .strict();

const trackRemoveCommandSchema = z
  .object({
    type: z.literal('track.remove'),
    payload: z
      .object({
        trackId: idSchema,
      })
      .strict(),
  })
  .strict();

const trackVolumeCommandSchema = z
  .object({
    type: z.literal('track.volume.set'),
    payload: z
      .object({
        trackId: idSchema,
        volume: unitValueSchema,
      })
      .strict(),
  })
  .strict();

const trackMuteCommandSchema = z
  .object({
    type: z.literal('track.mute.set'),
    payload: z
      .object({
        trackId: idSchema,
        muted: z.boolean(),
      })
      .strict(),
  })
  .strict();

const trackSoloCommandSchema = z
  .object({
    type: z.literal('track.solo.set'),
    payload: z
      .object({
        trackId: idSchema,
        soloed: z.boolean(),
      })
      .strict(),
  })
  .strict();

const trackPanCommandSchema = z
  .object({
    type: z.literal('track.pan.set'),
    payload: z
      .object({
        trackId: idSchema,
        pan: panValueSchema,
      })
      .strict(),
  })
  .strict();

const regionAddCommandSchema = z
  .object({
    type: z.literal('region.add'),
    payload: z
      .object({
        trackId: idSchema,
        assetId: idSchema,
        startTime: secondsSchema,
      })
      .strict(),
  })
  .strict();

const regionMoveCommandSchema = z
  .object({
    type: z.literal('region.move'),
    payload: z
      .object({
        trackId: idSchema,
        regionId: idSchema,
        startTime: secondsSchema,
      })
      .strict(),
  })
  .strict();

const regionSplitCommandSchema = z
  .object({
    type: z.literal('region.split'),
    payload: z
      .object({
        trackId: idSchema,
        regionId: idSchema,
        splitTime: secondsSchema,
      })
      .strict(),
  })
  .strict();

const regionResizeCommandSchema = z
  .object({
    type: z.literal('region.resize'),
    payload: z
      .object({
        trackId: idSchema,
        regionId: idSchema,
        duration: positiveNumberSchema,
      })
      .strict(),
  })
  .strict();

const regionRemoveCommandSchema = z
  .object({
    type: z.literal('region.remove'),
    payload: z
      .object({
        trackId: idSchema,
        regionId: idSchema,
      })
      .strict(),
  })
  .strict();

const sessionExportCommandSchema = z
  .object({
    type: z.literal('session.export'),
    payload: z
      .object({
        filename: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const commandSchema = z.discriminatedUnion('type', [
  playbackPlayCommandSchema,
  playbackPauseCommandSchema,
  playbackStopCommandSchema,
  playbackSeekCommandSchema,
  playbackLoopCommandSchema,
  playbackBpmCommandSchema,
  playbackMasterVolumeCommandSchema,
  trackAddCommandSchema,
  trackRemoveCommandSchema,
  trackVolumeCommandSchema,
  trackMuteCommandSchema,
  trackSoloCommandSchema,
  trackPanCommandSchema,
  regionAddCommandSchema,
  regionMoveCommandSchema,
  regionSplitCommandSchema,
  regionResizeCommandSchema,
  regionRemoveCommandSchema,
  sessionExportCommandSchema,
]);

export type AppCommand = z.infer<typeof commandSchema>;

export function parseCommand(rawCommand: unknown): AppCommand {
  return commandSchema.parse(rawCommand);
}

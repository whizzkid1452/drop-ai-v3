import { describe, expect, it } from 'vitest';
import { formatCommandResult } from './format-command-result';

describe('formatCommandResult', () => {
  it('formats a successful command without data', () => {
    expect(
      formatCommandResult({
        ok: true,
        command: { type: 'playback.pause' },
        data: undefined,
      })
    ).toBe('OK: playback.pause');
  });

  it('formats a successful command with data', () => {
    expect(
      formatCommandResult({
        ok: true,
        command: { type: 'track.add' },
        data: { id: 'track-1' },
      })
    ).toBe('OK: track.add {"id":"track-1"}');
  });

  it('formats command failures', () => {
    expect(
      formatCommandResult({
        ok: false,
        error: {
          code: 'COMMAND_VALIDATION_FAILED',
          message: 'Unknown command: warp.',
        },
      })
    ).toBe('Error: Unknown command: warp.');
  });

  it('formats local cli output', () => {
    expect(
      formatCommandResult({
        ok: true,
        kind: 'local',
        output: 'Drop AI CLI',
      })
    ).toBe('Drop AI CLI');
  });

  it('formats session export results without serializing the blob', () => {
    expect(
      formatCommandResult({
        ok: true,
        command: {
          type: 'session.export',
          payload: { filename: 'mix.wav' },
        },
        data: {
          blob: new Blob(['wav'], { type: 'audio/wav' }),
          filename: 'mix.wav',
        },
      })
    ).toBe('OK: session.export filename=mix.wav size=3 bytes');
  });
});

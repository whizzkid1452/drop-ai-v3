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
});

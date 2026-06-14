import { describe, expect, it, vi } from 'vitest';
import {
  downloadSessionExportResult,
  getSessionExportResult,
} from './session-export-download';

describe('getSessionExportResult', () => {
  it('returns session export data from a successful session export command', () => {
    const blob = new Blob(['wav'], { type: 'audio/wav' });

    expect(
      getSessionExportResult({
        ok: true,
        command: {
          type: 'session.export',
          payload: { filename: 'mix.wav' },
        },
        data: { blob, filename: 'mix.wav' },
      })
    ).toEqual({ blob, filename: 'mix.wav' });
  });

  it('ignores local command results', () => {
    expect(
      getSessionExportResult({
        ok: true,
        kind: 'local',
        output: 'Drop AI CLI',
      })
    ).toBeUndefined();
  });
});

describe('downloadSessionExportResult', () => {
  it('downloads exported session blobs with the returned filename', () => {
    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    const createObjectUrl = vi.fn(() => 'blob:mix');
    const revokeObjectUrl = vi.fn();

    const downloaded = downloadSessionExportResult(
      {
        ok: true,
        command: {
          type: 'session.export',
          payload: { filename: 'mix.wav' },
        },
        data: {
          blob: new Blob(['wav'], { type: 'audio/wav' }),
          filename: 'mix.wav',
        },
      },
      {
        createAnchor: () => anchor,
        createObjectUrl,
        revokeObjectUrl,
      }
    );

    expect(downloaded).toBe(true);
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchor.href).toBe('blob:mix');
    expect(anchor.download).toBe('mix.wav');
    expect(click).toHaveBeenCalledOnce();
    expect(document.body.contains(anchor)).toBe(false);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:mix');
  });

  it('does not create a download for command failures', () => {
    const createObjectUrl = vi.fn(() => 'blob:mix');

    const downloaded = downloadSessionExportResult(
      {
        ok: false,
        error: {
          code: 'COMMAND_EXECUTION_FAILED',
          message: 'Cannot export an empty session.',
        },
      },
      { createObjectUrl }
    );

    expect(downloaded).toBe(false);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});

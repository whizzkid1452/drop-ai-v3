import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_AUDIO_FILE_ACCEPT,
  validateAudioFile,
} from './upload-file-validation';

describe('validateAudioFile', () => {
  it('exposes an accept attribute value for supported extensions only', () => {
    expect(SUPPORTED_AUDIO_FILE_ACCEPT).toBe('.wav,.mp3,.m4a,.aac,.ogg,.flac');
  });

  it('accepts files with supported audio extensions', () => {
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });

    expect(validateAudioFile(file)).toEqual({ ok: true });
  });

  it('accepts known audio extensions when the mime type is unavailable', () => {
    const file = new File(['audio'], 'loop.MP3', { type: '' });

    expect(validateAudioFile(file)).toEqual({ ok: true });
  });

  it('rejects unsupported extensions even when the mime type is audio', () => {
    const file = new File(['audio'], 'loop.webm', { type: 'audio/webm' });

    expect(validateAudioFile(file)).toEqual({
      ok: false,
      message: 'Use a supported audio file: wav, mp3, m4a, aac, ogg, or flac.',
    });
  });

  it('rejects missing or unsupported files', () => {
    expect(validateAudioFile(undefined)).toEqual({
      ok: false,
      message: 'Select an audio file.',
    });
    expect(
      validateAudioFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))
    ).toEqual({
      ok: false,
      message: 'Use a supported audio file: wav, mp3, m4a, aac, ogg, or flac.',
    });
  });
});

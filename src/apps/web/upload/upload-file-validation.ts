const AUDIO_FILE_EXTENSIONS = new Set([
  'aac',
  'flac',
  'm4a',
  'mp3',
  'ogg',
  'wav',
]);

export type FileValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateAudioFile(
  file: File | undefined
): FileValidationResult {
  if (!file) {
    return { ok: false, message: 'Select an audio file.' };
  }

  if (file.type.startsWith('audio/')) {
    return { ok: true };
  }

  const extension = getFileExtension(file.name);
  if (extension && AUDIO_FILE_EXTENSIONS.has(extension)) {
    return { ok: true };
  }

  return {
    ok: false,
    message: 'Use a supported audio file: wav, mp3, m4a, aac, ogg, or flac.',
  };
}

function getFileExtension(filename: string): string | undefined {
  const dotIndex = filename.lastIndexOf('.');

  if (dotIndex < 0 || dotIndex === filename.length - 1) {
    return undefined;
  }

  return filename.slice(dotIndex + 1).toLowerCase();
}

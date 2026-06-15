export const SUPPORTED_AUDIO_FILE_EXTENSIONS = [
  'wav',
  'mp3',
  'm4a',
  'aac',
  'ogg',
  'flac',
] as const;

export const SUPPORTED_AUDIO_FILE_ACCEPT = SUPPORTED_AUDIO_FILE_EXTENSIONS.map(
  (extension) => `.${extension}`
).join(',');

const SUPPORTED_AUDIO_FILE_EXTENSION_SET: ReadonlySet<string> = new Set(
  SUPPORTED_AUDIO_FILE_EXTENSIONS
);

const SUPPORTED_AUDIO_FILE_MESSAGE =
  'Use a supported audio file: wav, mp3, m4a, aac, ogg, or flac.';

export type FileValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateAudioFile(
  file: File | undefined
): FileValidationResult {
  if (!file) {
    return { ok: false, message: 'Select an audio file.' };
  }

  const extension = getFileExtension(file.name);
  if (extension && SUPPORTED_AUDIO_FILE_EXTENSION_SET.has(extension)) {
    return { ok: true };
  }

  return {
    ok: false,
    message: SUPPORTED_AUDIO_FILE_MESSAGE,
  };
}

function getFileExtension(filename: string): string | undefined {
  const dotIndex = filename.lastIndexOf('.');

  if (dotIndex < 0 || dotIndex === filename.length - 1) {
    return undefined;
  }

  return filename.slice(dotIndex + 1).toLowerCase();
}

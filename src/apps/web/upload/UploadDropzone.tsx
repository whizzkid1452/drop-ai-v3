import { useState } from 'react';
import { validateAudioFile } from './upload-file-validation';
import * as styles from './UploadDropzone.css';

export interface UploadDropzoneProps {
  disabled?: boolean;
  errorMessage?: string;
  onFileAccepted: (file: File) => void;
}

export function UploadDropzone({
  disabled = false,
  errorMessage,
  onFileAccepted,
}: UploadDropzoneProps) {
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );
  const message = errorMessage ?? validationMessage;

  function handleFile(file: File | undefined): void {
    if (!file) {
      setValidationMessage('Select an audio file.');
      return;
    }

    const validation = validateAudioFile(file);

    if (!validation.ok) {
      setValidationMessage(validation.message);
      return;
    }

    setValidationMessage(null);
    onFileAccepted(file);
  }

  return (
    <section className={styles.uploadShell} data-testid="upload-screen">
      <div className={styles.uploadPanel}>
        <label
          className={`${styles.dropzone} ${disabled ? styles.dropzoneDisabled : ''}`}
          data-testid="upload-dropzone"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (disabled) {
              return;
            }
            handleFile(event.dataTransfer.files[0]);
          }}
        >
          <input
            accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac"
            className={styles.fileInput}
            data-testid="upload-file-input"
            disabled={disabled}
            type="file"
            onChange={(event) => {
              handleFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
          <h1 className={styles.title}>Drop AI v3</h1>
          <p className={styles.description}>
            Drop an audio file to start an editable command session.
          </p>
          <span className={styles.actionText}>
            {disabled ? 'Importing audio' : 'Choose audio file'}
          </span>
        </label>
        <p className={styles.message} data-testid="upload-message">
          {message ?? ''}
        </p>
      </div>
    </section>
  );
}

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SUPPORTED_AUDIO_FILE_ACCEPT } from './upload-file-validation';
import { UploadDropzone } from './UploadDropzone';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  document.body.replaceChildren();
});

describe('UploadDropzone', () => {
  it('limits the file picker to supported audio extensions', () => {
    const container = renderUploadDropzone();
    const input = queryFileInput(container);

    expect(input.accept).toBe(SUPPORTED_AUDIO_FILE_ACCEPT);
    expect(input.accept).not.toContain('audio/*');
  });
});

function renderUploadDropzone(): HTMLElement {
  const container = document.createElement('div');

  root = createRoot(container);
  act(() => {
    root?.render(<UploadDropzone onFileAccepted={vi.fn()} />);
  });

  return container;
}

function queryFileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('[data-testid="upload-file-input"]');

  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Could not find upload file input.');
  }

  return input;
}

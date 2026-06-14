import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createApp, type IAppHandle } from '@/composition/create-app';
import App from './App';
import { AppProvider } from './AppProvider';

vi.mock('./cli/CliTerminal', () => ({
  CliTerminal: ({
    uploadInfo,
  }: {
    uploadInfo: { assetId: string; trackId: string; regionId: string };
  }) => (
    <div data-testid="cli-terminal">
      CLI {uploadInfo.assetId} {uploadInfo.trackId} {uploadInfo.regionId}
    </div>
  ),
}));

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

describe('App upload-first flow', () => {
  it('renders only the upload screen before a file is uploaded', () => {
    const { container } = renderApp();

    expect(queryByTestId(container, 'upload-dropzone')).not.toBeNull();
    expect(queryByTestId(container, 'cli-terminal')).toBeNull();
    expect(queryByTestId(container, 'session-id')).toBeNull();
    expect(queryByTestId(container, 'add-track')).toBeNull();
  });

  it('registers the uploaded file and opens the CLI with an editable session', async () => {
    const { app, container } = renderApp();
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });

    await uploadFile(container, file);

    const session = app.sessionReader.getState();
    expect(session.trackOrder).toEqual(['track-1']);
    expect(session.tracksById['track-1'].regionOrder).toEqual(['region-1']);
    expect(session.tracksById['track-1'].regionsById['region-1']).toMatchObject(
      {
        assetId: 'asset-1',
        startTime: 0,
        duration: 4,
      }
    );
    expect(getText(container, 'cli-terminal')).toContain('asset-1');
    expect(getText(container, 'cli-terminal')).toContain('track-1');
    expect(getText(container, 'cli-terminal')).toContain('region-1');
  });
});

function renderApp(): { app: IAppHandle; container: HTMLElement } {
  const app = createApp({
    audioEngine: new FakeAudioEngine({
      assetDurations: { 'asset-1': 4 },
    }),
    idGenerator: createPerPrefixIdGenerator(),
    sessionId: 'session-1',
  });
  const container = document.createElement('div');

  root = createRoot(container);
  act(() => {
    root?.render(
      <AppProvider createAppHandle={() => app}>
        <App />
      </AppProvider>
    );
  });

  return { app, container };
}

async function uploadFile(container: HTMLElement, file: File): Promise<void> {
  const input = queryByTestId(container, 'upload-file-input');

  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Could not find upload input.');
  }

  await act(async () => {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  });

  await act(async () => {
    await Promise.resolve();
  });
}

function createPerPrefixIdGenerator() {
  const counters: Record<string, number> = {};

  return {
    next(prefix = 'id') {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
  };
}

function queryByTestId(container: HTMLElement, testId: string): Element | null {
  return container.querySelector(`[data-testid="${testId}"]`);
}

function getText(container: HTMLElement, testId: string): string {
  const element = queryByTestId(container, testId);

  if (!element) {
    throw new Error(`Could not find element with test id "${testId}".`);
  }

  return element.textContent ?? '';
}

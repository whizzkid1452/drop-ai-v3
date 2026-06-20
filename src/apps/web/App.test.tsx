import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createApp, type IAppHandle } from '@/composition/create-app';
import { createCallRecorder } from '@/testing/call-recorder';
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
    expect(queryByTestId(container, 'transport-play')).toBeNull();
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

  it('runs transport controls through playback commands', async () => {
    const { app, container, recorder } = renderApp();
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });

    await uploadFile(container, file);

    expect(getText(container, 'transport-time')).toBe('0:00 / 0:04');

    await clickByTestId(container, 'transport-play');

    expect(app.sessionReader.getState().playback.playing).toBe(true);
    expect(recorder.getCalls('play')).toHaveLength(1);

    await clickByTestId(container, 'transport-pause');

    expect(app.sessionReader.getState().playback.playing).toBe(false);
    expect(recorder.getCalls('pause')).toHaveLength(1);

    await seek(container, 2.5);

    expect(app.sessionReader.getState().playback.positionSeconds).toBe(2.5);
    expect(recorder.getCalls('seek')[0].args).toEqual([2.5]);

    await clickByTestId(container, 'transport-stop');

    expect(app.sessionReader.getState().playback.positionSeconds).toBe(0);
    expect(recorder.getCalls('stop')).toHaveLength(1);
  });
});

function renderApp(): {
  app: IAppHandle;
  container: HTMLElement;
  recorder: ReturnType<typeof createCallRecorder>;
} {
  const recorder = createCallRecorder();
  const app = createApp({
    audioEngine: new FakeAudioEngine({
      recorder,
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

  return { app, container, recorder };
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

async function clickByTestId(
  container: HTMLElement,
  testId: string
): Promise<void> {
  const element = queryByTestId(container, testId);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Could not find clickable element "${testId}".`);
  }

  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushMicrotasks();
  });
}

async function seek(container: HTMLElement, seconds: number): Promise<void> {
  const element = queryByTestId(container, 'transport-seek');

  if (!(element instanceof HTMLInputElement)) {
    throw new Error('Could not find transport seek input.');
  }

  await act(async () => {
    element.value = seconds.toString();
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await flushMicrotasks();
  });
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
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

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { ScriptedAgentPlanner } from '@/apps/agent/scripted-agent-planner';
import { createApp, type IAppHandle } from '@/composition/create-app';
import { AppProvider } from '../AppProvider';
import {
  uploadFileToSession,
  type UploadedSessionInfo,
} from '../upload/upload-session-flow';
import { CliTerminal } from './CliTerminal';

const xtermMock = vi.hoisted(() => ({
  writes: [] as string[],
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(function createFitAddon() {
    return {
      fit: vi.fn(),
    };
  }),
}));

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function createTerminal() {
    return {
      dispose: vi.fn(),
      focus: vi.fn(),
      loadAddon: vi.fn(),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      open: vi.fn(),
      write: vi.fn((value: string) => {
        xtermMock.writes.push(value);
      }),
    };
  }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;

beforeEach(() => {
  xtermMock.writes.length = 0;
  Object.assign(globalThis, { ResizeObserver: TestResizeObserver });
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  document.body.replaceChildren();
});

describe('CliTerminal command buttons', () => {
  it('renders the CLI input surface before the command button panel', async () => {
    const { app, uploadInfo } = await setupUploadedApp();
    const container = renderTerminal(app, uploadInfo);
    const terminal = findByTestId(container, 'cli-terminal');
    const commandButtons = findByTestId(container, 'cli-command-buttons');

    expect(
      terminal.compareDocumentPosition(commandButtons) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('runs a track-scoped CLI command with the uploaded trackId', async () => {
    const { app, uploadInfo } = await setupUploadedApp();
    const container = renderTerminal(app, uploadInfo);
    const button = findCommandButton(container, 'volume <trackId> <0..1>');

    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushMicrotasks();
    });

    expect(
      app.sessionReader.getState().tracksById[uploadInfo.trackId].volume
    ).toBe(0.8);
    expect(xtermMock.writes.join('')).toContain(
      `volume ${uploadInfo.trackId} 0.8`
    );
  });

  it('opens the upload file picker during the button click handler', async () => {
    const { app, uploadInfo } = await setupUploadedApp();
    const container = renderTerminal(app, uploadInfo);
    const button = findCommandButton(container, 'asset upload');
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined);

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
  });
});

function renderTerminal(
  app: IAppHandle,
  uploadInfo: UploadedSessionInfo
): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);

  root = createRoot(container);
  act(() => {
    root?.render(
      <AppProvider
        createAgentPlanner={createNoopAgentPlanner}
        createAppHandle={() => app}
      >
        <CliTerminal uploadInfo={uploadInfo} />
      </AppProvider>
    );
  });

  return container;
}

function createNoopAgentPlanner(): ScriptedAgentPlanner {
  return new ScriptedAgentPlanner({ scripts: {} });
}

function findByTestId(container: HTMLElement, testId: string): HTMLElement {
  const element = container.querySelector(`[data-testid="${testId}"]`);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Could not find element "${testId}".`);
  }

  return element;
}

function findCommandButton(container: HTMLElement, usage: string): HTMLElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('data-command-usage') === usage
  );

  if (!(button instanceof HTMLElement)) {
    throw new Error(`Could not find command button for usage: ${usage}`);
  }

  return button;
}

async function setupUploadedApp(): Promise<{
  app: IAppHandle;
  uploadInfo: UploadedSessionInfo;
}> {
  const app = createApp({
    audioEngine: new FakeAudioEngine({
      assetDurations: { 'asset-1': 4 },
    }),
    idGenerator: createPerPrefixIdGenerator(),
    sessionId: 'session-1',
  });
  const uploadResult = await uploadFileToSession(
    new File(['audio'], 'loop.wav', { type: 'audio/wav' }),
    app.controller
  );

  if (!uploadResult.ok) {
    throw new Error(uploadResult.message);
  }

  return { app, uploadInfo: uploadResult.uploadInfo };
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

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

class TestResizeObserver {
  observe(): void {
    return;
  }

  disconnect(): void {
    return;
  }
}

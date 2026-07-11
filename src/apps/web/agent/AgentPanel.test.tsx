import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ScriptedAgentPlanner } from '@/apps/agent/scripted-agent-planner';
import type { IAgentPlanner } from '@/apps/agent/agent-workflow';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createApp, type IAppHandle } from '@/composition/create-app';
import { createTestIdGenerator } from '@/testing/id-generator';
import { AppProvider } from '../AppProvider';
import { AgentPanel } from './AgentPanel';

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

describe('AgentPanel', () => {
  it('executes a command plan immediately when Enter submits the request', async () => {
    const { app, container } = renderAgentPanel({
      scripts: {
        'set range': {
          steps: [
            {
              command: {
                type: 'session.exportRange.start.set',
                payload: { seconds: 1 },
              },
              id: 'step-1',
              reason: 'Set the export range start.',
            },
            {
              command: {
                type: 'session.exportRange.end.set',
                payload: { seconds: 3 },
              },
              id: 'step-2',
              reason: 'Set the export range end.',
            },
          ],
        },
      },
    });

    await submitRequestWithEnter(container, 'set range');

    expect(app.sessionReader.getState().exportRange).toMatchObject({
      endSeconds: 3,
      startSeconds: 1,
    });
    expect(getTexts(container, 'agent-message')).toContain(
      'Completed 2 commands.'
    );
  });

  it('shows validation errors without executing commands', async () => {
    const { app, container } = renderAgentPanel({ scripts: {} });

    await submitRequestWithEnter(container, 'unknown request');

    expect(getTexts(container, 'agent-message')).toContain(
      'Agent plan must include at least one step.'
    );
    expect(app.sessionReader.getState().playback.positionSeconds).toBe(0);
  });

  it('shows planner failures and re-enables the input', async () => {
    const { app, container } = renderAgentPanel({
      createAgentPlanner: createRejectingPlanner,
    });

    await submitRequestWithEnter(container, 'preview');

    expect(getTexts(container, 'agent-message')).toContain(
      'Agent planner failed to create a command plan.'
    );
    expect(app.sessionReader.getState().playback.positionSeconds).toBe(0);
    expect(getTextArea(container, 'agent-request-input').disabled).toBe(false);
  });
});

function renderAgentPanel(input: {
  createAgentPlanner?: () => IAgentPlanner;
  scripts?: ConstructorParameters<typeof ScriptedAgentPlanner>[0]['scripts'];
}): {
  app: IAppHandle;
  container: HTMLElement;
} {
  const app = createApp({
    audioEngine: new FakeAudioEngine(),
    idGenerator: createTestIdGenerator(),
    sessionId: 'session-test',
  });
  const container = document.createElement('div');

  root = createRoot(container);
  act(() => {
    root?.render(
      <AppProvider
        createAgentPlanner={
          input.createAgentPlanner ??
          (() => new ScriptedAgentPlanner({ scripts: input.scripts ?? {} }))
        }
        createAppHandle={() => app}
      >
        <AgentPanel />
      </AppProvider>
    );
  });

  return { app, container };
}

function createRejectingPlanner(): IAgentPlanner {
  return {
    async createPlan() {
      throw new Error('provider unavailable');
    },
  };
}

async function submitRequestWithEnter(
  container: HTMLElement,
  requestText: string
): Promise<void> {
  const input = getTextArea(container, 'agent-request-input');

  await act(async () => {
    setTextAreaValue(input, requestText);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flushMicrotasks();
  });

  await act(async () => {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })
    );
    await flushMicrotasks();
  });
}

function setTextAreaValue(
  input: HTMLTextAreaElement,
  requestText: string
): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  )?.set;

  if (!valueSetter) {
    input.value = requestText;
    return;
  }

  valueSetter.call(input, requestText);
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

function queryByTestId(container: HTMLElement, testId: string): Element | null {
  return container.querySelector(`[data-testid="${testId}"]`);
}

function getTextArea(
  container: HTMLElement,
  testId: string
): HTMLTextAreaElement {
  const element = queryByTestId(container, testId);

  if (!(element instanceof HTMLTextAreaElement)) {
    throw new Error(`Could not find textarea with test id "${testId}".`);
  }

  return element;
}

function getTexts(container: HTMLElement, testId: string): string[] {
  return Array.from(
    container.querySelectorAll(`[data-testid="${testId}"]`)
  ).map((element) => element.textContent ?? '');
}

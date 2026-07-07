import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ScriptedAgentPlanner } from '@/apps/agent/scripted-agent-planner';
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
  it('previews a command plan and executes it after approval', async () => {
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

    await requestPlan(container, 'set range');

    expect(getText(container, 'agent-plan-status')).toBe('Draft plan');
    expect(getTexts(container, 'agent-plan-step-command')).toEqual([
      'session.exportRange.start.set',
      'session.exportRange.end.set',
    ]);

    await clickByTestId(container, 'agent-approve-plan');

    expect(app.sessionReader.getState().exportRange).toMatchObject({
      endSeconds: 3,
      startSeconds: 1,
    });
    expect(getText(container, 'agent-execution-message')).toBe(
      'Completed 2 commands.'
    );
  });

  it('shows validation errors without executing commands', async () => {
    const { app, container } = renderAgentPanel({ scripts: {} });

    await requestPlan(container, 'unknown request');

    expect(getText(container, 'agent-error')).toBe(
      'Agent plan must include at least one step.'
    );
    expect(app.sessionReader.getState().playback.positionSeconds).toBe(0);
  });
});

function renderAgentPanel(input: {
  scripts: ConstructorParameters<typeof ScriptedAgentPlanner>[0]['scripts'];
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
        createAgentPlanner={() => new ScriptedAgentPlanner(input)}
        createAppHandle={() => app}
      >
        <AgentPanel />
      </AppProvider>
    );
  });

  return { app, container };
}

async function requestPlan(
  container: HTMLElement,
  requestText: string
): Promise<void> {
  const input = queryByTestId(container, 'agent-request-input');

  if (!(input instanceof HTMLTextAreaElement)) {
    throw new Error('Could not find agent request input.');
  }

  await act(async () => {
    setTextAreaValue(input, requestText);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flushMicrotasks();
  });

  await clickByTestId(container, 'agent-request-plan');
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

async function clickByTestId(
  container: HTMLElement,
  testId: string
): Promise<void> {
  const element = queryByTestId(container, testId);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Could not find clickable element "${testId}".`);
  }

  await act(async () => {
    element.click();
    await flushMicrotasks();
  });
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
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

function getTexts(container: HTMLElement, testId: string): string[] {
  return Array.from(
    container.querySelectorAll(`[data-testid="${testId}"]`)
  ).map((element) => element.textContent ?? '');
}

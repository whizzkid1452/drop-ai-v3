import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ScriptedAgentPlanner } from '@/apps/agent/scripted-agent-planner';
import type { IAgentPlanner } from '@/apps/agent/agent-workflow';
import type { AgentPlanDraft } from '@/apps/agent/agent-plan';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createApp, type IAppHandle } from '@/composition/create-app';
import { createTestIdGenerator } from '@/testing/id-generator';
import { AppProvider } from '../AppProvider';
import type { CreateDefaultAgentPlannerInput } from './default-agent-planner';
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

  it('submits the message when Enter is pressed in the textarea', async () => {
    const { container } = renderAgentPanel({
      scripts: {
        play: {
          steps: [
            {
              command: { type: 'playback.play' },
              id: 'step-1',
              reason: 'Start playback.',
            },
          ],
        },
      },
    });

    await requestPlanWithEnter(container, 'play');

    expect(getText(container, 'agent-plan-status')).toBe('Draft plan');
    expect(getTexts(container, 'agent-plan-step-command')).toEqual([
      'playback.play',
    ]);
  });

  it('shows a chat response without executing commands when no plan is returned', async () => {
    const { app, container } = renderAgentPanel({ scripts: {} });

    await requestPlan(container, 'unknown request');

    expect(getTexts(container, 'agent-message-content')).toEqual([
      'unknown request',
      'I can answer questions about this session, or prepare a command plan when you ask for a concrete DAW action.',
    ]);
    expect(queryByTestId(container, 'agent-error')).toBeNull();
    expect(queryByTestId(container, 'agent-plan-status')).toBeNull();
    expect(app.sessionReader.getState().playback.positionSeconds).toBe(0);
  });

  it('shows planner failures and re-enables the plan control', async () => {
    const { app, container } = renderAgentPanel({
      createAgentPlanner: createRejectingPlanner,
    });

    await requestPlan(container, 'preview');

    expect(getText(container, 'agent-error')).toBe(
      'Agent failed to create a chat response.'
    );
    expect(app.sessionReader.getState().playback.positionSeconds).toBe(0);
    expect(getButton(container, 'agent-request-plan').disabled).toBe(false);
  });

  it('shows WebLLM model loading progress while planning is pending', async () => {
    const deferredPlan = createDeferred<AgentPlanDraft>();
    const { container } = renderAgentPanel({
      createAgentPlanner: ({ webLLMInitProgressCallback }) => ({
        async createPlan() {
          webLLMInitProgressCallback?.({
            progress: 0.42,
            text: 'Loading model shards.',
            timeElapsed: 1,
          });

          return await deferredPlan.promise;
        },
      }),
    });

    await requestPlan(container, 'play');

    expect(getText(container, 'agent-planner-progress-percent')).toBe('42%');
    expect(getText(container, 'agent-planner-progress-message')).toBe(
      'Loading model shards.'
    );

    await act(async () => {
      deferredPlan.resolve({
        steps: [
          {
            command: { type: 'playback.play' },
            id: 'step-1',
            reason: 'Start playback.',
          },
        ],
      });
      await flushMicrotasks();
    });

    expect(getText(container, 'agent-plan-status')).toBe('Draft plan');
  });

  it('starts WebLLM model preload on mount and shows progress before a request', async () => {
    const deferredPreload = createDeferred<void>();
    let didStartPreload = false;
    const { container } = renderAgentPanel({
      createAgentPlanner: ({ webLLMInitProgressCallback }) => ({
        async createPlan() {
          return {
            steps: [
              {
                command: { type: 'playback.play' },
                id: 'step-1',
                reason: 'Start playback.',
              },
            ],
          };
        },
        async preload() {
          didStartPreload = true;
          webLLMInitProgressCallback?.({
            progress: 0.3,
            text: 'Downloading model.',
            timeElapsed: 1,
          });

          await deferredPreload.promise;
        },
      }),
    });

    await act(async () => {
      await flushMicrotasks();
    });

    expect(didStartPreload).toBe(true);
    expect(getText(container, 'agent-planner-progress-status')).toBe(
      'Model loading'
    );
    expect(getText(container, 'agent-planner-progress-percent')).toBe('30%');
    expect(getText(container, 'agent-planner-progress-message')).toBe(
      'Downloading model.'
    );

    await act(async () => {
      deferredPreload.resolve(undefined);
      await flushMicrotasks();
    });

    expect(getText(container, 'agent-planner-progress-status')).toBe(
      'Model ready'
    );
    expect(getText(container, 'agent-planner-progress-percent')).toBe('100%');
    expect(getText(container, 'agent-planner-progress-message')).toBe(
      'Model ready.'
    );
  });
});

function renderAgentPanel(input: {
  createAgentPlanner?: (input: CreateDefaultAgentPlannerInput) => IAgentPlanner;
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

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve: ((value: T) => void) | null = null;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return {
    promise,
    resolve(value) {
      if (!resolve) {
        throw new Error('Deferred promise resolver is not ready.');
      }

      resolve(value);
    },
  };
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

async function requestPlanWithEnter(
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
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
      })
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

function getButton(container: HTMLElement, testId: string): HTMLButtonElement {
  const element = queryByTestId(container, testId);

  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Could not find button with test id "${testId}".`);
  }

  return element;
}

function getTexts(container: HTMLElement, testId: string): string[] {
  return Array.from(
    container.querySelectorAll(`[data-testid="${testId}"]`)
  ).map((element) => element.textContent ?? '');
}

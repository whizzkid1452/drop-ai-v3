import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createApp } from '@/composition/create-app';
import type { AppController } from '@/controllers/app-controller';
import type { AgentWorkflow } from '@/apps/agent/agent-workflow';
import { ScriptedAgentPlanner } from '@/apps/agent/scripted-agent-planner';
import { createTestIdGenerator } from '@/testing/id-generator';
import {
  AppProvider,
  useAgentWorkflow,
  useAppController,
  useSessionState,
} from './AppProvider';

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

describe('AppProvider', () => {
  it('subscribes React to session state updated by controller commands', async () => {
    let capturedController: AppController | null = null;
    const container = document.createElement('div');

    function Harness() {
      capturedController = useAppController();
      const session = useSessionState();

      return <p data-testid="track-count">{session.trackOrder.length}</p>;
    }

    root = createRoot(container);
    act(() => {
      root?.render(
        <AppProvider
          createAgentPlanner={createNoopAgentPlanner}
          createAppHandle={() =>
            createApp({
              audioEngine: new FakeAudioEngine(),
              idGenerator: createTestIdGenerator(),
              sessionId: 'session-test',
            })
          }
        >
          <Harness />
        </AppProvider>
      );
    });

    expect(getText(container, 'track-count')).toBe('0');

    await act(async () => {
      if (!capturedController) {
        throw new Error('Controller was not captured.');
      }

      const result = await capturedController.executeCommand({
        type: 'track.add',
      });
      expect(result.ok).toBe(true);
    });

    expect(getText(container, 'track-count')).toBe('1');
  });

  it('disposes the app handle on unmount', () => {
    const app = createApp({
      audioEngine: new FakeAudioEngine(),
      idGenerator: createTestIdGenerator(),
      sessionId: 'session-test',
    });
    const disposeSpy = vi.spyOn(app, 'dispose');
    const container = document.createElement('div');

    root = createRoot(container);
    act(() => {
      root?.render(
        <AppProvider
          createAgentPlanner={createNoopAgentPlanner}
          createAppHandle={() => app}
        >
          <p>Mounted</p>
        </AppProvider>
      );
    });

    act(() => {
      root?.unmount();
    });
    root = null;

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('provides an agent workflow that executes through the current app controller', async () => {
    let capturedWorkflow: AgentWorkflow | null = null;
    const app = createApp({
      audioEngine: new FakeAudioEngine(),
      idGenerator: createTestIdGenerator(),
      sessionId: 'session-test',
    });
    const container = document.createElement('div');

    function Harness() {
      capturedWorkflow = useAgentWorkflow();

      return <p data-testid="mounted">mounted</p>;
    }

    root = createRoot(container);
    act(() => {
      root?.render(
        <AppProvider
          createAgentPlanner={() =>
            new ScriptedAgentPlanner({
              scripts: {
                seek: {
                  steps: [
                    {
                      command: {
                        type: 'playback.seek',
                        payload: { seconds: 2 },
                      },
                      id: 'step-1',
                      reason: 'Move the playhead.',
                    },
                  ],
                },
              },
            })
          }
          createAppHandle={() => app}
        >
          <Harness />
        </AppProvider>
      );
    });

    await act(async () => {
      if (!capturedWorkflow) {
        throw new Error('Agent workflow was not captured.');
      }

      const planResult = await capturedWorkflow.requestPlan({
        requestText: 'seek',
      });
      if (!planResult.ok) {
        throw new Error('Expected agent plan request to succeed.');
      }

      const executionResult = await capturedWorkflow.approvePlan({
        plan: planResult.plan,
      });
      expect(executionResult.ok).toBe(true);
    });

    expect(app.sessionReader.getState().playback.positionSeconds).toBe(2);
  });
});

function createNoopAgentPlanner(): ScriptedAgentPlanner {
  return new ScriptedAgentPlanner({ scripts: {} });
}

function getText(container: HTMLElement, testId: string): string {
  const element = container.querySelector(`[data-testid="${testId}"]`);

  if (!element) {
    throw new Error(`Could not find element with test id "${testId}".`);
  }

  return element.textContent ?? '';
}

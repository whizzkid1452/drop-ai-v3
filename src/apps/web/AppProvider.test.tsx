import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '@/composition/create-app';
import type { AppController } from '@/controllers/app-controller';
import { createTestIdGenerator } from '@/testing/id-generator';
import { AppProvider, useAppController, useSessionState } from './AppProvider';

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
          createAppHandle={() =>
            createApp({
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
      idGenerator: createTestIdGenerator(),
      sessionId: 'session-test',
    });
    const disposeSpy = vi.spyOn(app, 'dispose');
    const container = document.createElement('div');

    root = createRoot(container);
    act(() => {
      root?.render(
        <AppProvider createAppHandle={() => app}>
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
});

function getText(container: HTMLElement, testId: string): string {
  const element = container.querySelector(`[data-testid="${testId}"]`);

  if (!element) {
    throw new Error(`Could not find element with test id "${testId}".`);
  }

  return element.textContent ?? '';
}

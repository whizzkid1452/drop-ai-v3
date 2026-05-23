import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { AutosaveController } from './autosave-controller';
import {
  createSessionStore,
  type SessionStore,
} from '@/layers/core/session/session-store';
import { createEmptySession } from '@/layers/core/session/session-state';
import { addTrack } from '@/layers/core/session/session-operations';

const NOW = '2026-05-23T00:00:00.000Z';
const DEBOUNCE_MS = 200;

interface Harness {
  store: SessionStore;
  saveSession: Mock<() => Promise<void>>;
  controller: AutosaveController;
}

function setup(): Harness {
  const store = createSessionStore({
    initialSession: createEmptySession({ id: 'session-1', now: NOW }),
  });
  const saveSession = vi.fn(async () => {
    store.applyOperation(state => ({ ...state, dirty: false }));
  });
  const controller = new AutosaveController({
    sessionStore: store,
    saveSession,
    debounceMs: DEBOUNCE_MS,
  });
  return { store, saveSession, controller };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AutosaveController', () => {
  it('schedules a save when the session becomes dirty', async () => {
    const h = setup();

    h.store.applyOperation(state =>
      addTrack(state, { trackId: 'track-1', name: 'A', now: NOW })
    );
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(h.saveSession).toHaveBeenCalledTimes(1);
  });

  it('debounces repeated changes inside the window into a single save', async () => {
    const h = setup();

    h.store.applyOperation(state =>
      addTrack(state, { trackId: 'track-1', name: 'A', now: NOW })
    );
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS / 2);
    h.store.applyOperation(state =>
      addTrack(state, { trackId: 'track-2', name: 'B', now: NOW })
    );
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS / 2);
    expect(h.saveSession).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(h.saveSession).toHaveBeenCalledTimes(1);
  });

  it('does not save a clean session', async () => {
    const h = setup();

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);

    expect(h.saveSession).not.toHaveBeenCalled();
  });

  it('stops scheduling after dispose()', async () => {
    const h = setup();

    h.controller.dispose();
    h.store.applyOperation(state =>
      addTrack(state, { trackId: 'track-1', name: 'A', now: NOW })
    );
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);

    expect(h.saveSession).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createSessionStore } from './session-store';
import { createEmptySession } from './session-state';
import { addTrack } from './session-operations';

const NOW = '2026-05-23T00:00:00.000Z';

function initialSession() {
  return createEmptySession({ id: 'session-1', now: NOW });
}

describe('createSessionStore', () => {
  it('exposes the initial session via getState', () => {
    const store = createSessionStore({ initialSession: initialSession() });

    expect(store.getState()).toEqual(initialSession());
  });

  it('applies a pure operation and replaces state immutably', () => {
    const store = createSessionStore({ initialSession: initialSession() });

    store.applyOperation(state =>
      addTrack(state, { trackId: 'track-1', name: 'A', now: NOW })
    );

    const next = store.getState();
    expect(next.trackOrder).toEqual(['track-1']);
    expect(next.dirty).toBe(true);
  });

  it('notifies subscribers when state changes', () => {
    const store = createSessionStore({ initialSession: initialSession() });
    const listener = vi.fn();
    store.subscribe(listener);

    store.applyOperation(state =>
      addTrack(state, { trackId: 'track-1', name: 'A', now: NOW })
    );

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns an unsubscribe function from subscribe', () => {
    const store = createSessionStore({ initialSession: initialSession() });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.applyOperation(state =>
      addTrack(state, { trackId: 'track-1', name: 'A', now: NOW })
    );

    expect(listener).not.toHaveBeenCalled();
  });

  it('replaces the entire state via replaceState', () => {
    const store = createSessionStore({ initialSession: initialSession() });
    const replacement = createEmptySession({
      id: 'restored',
      now: '2026-05-23T00:01:00.000Z',
    });

    store.replaceState(replacement);

    expect(store.getState()).toEqual(replacement);
  });

  it('marks dirty false after replaceState (since incoming snapshot decides)', () => {
    const store = createSessionStore({ initialSession: initialSession() });
    const replacement = {
      ...initialSession(),
      id: 'restored',
      dirty: false,
    };

    store.applyOperation(state =>
      addTrack(state, { trackId: 'track-1', name: 'A', now: NOW })
    );
    store.replaceState(replacement);

    expect(store.getState().dirty).toBe(false);
  });
});

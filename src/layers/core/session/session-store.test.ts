import { describe, expect, it, vi } from 'vitest';
import { createSessionStore } from './session-store';
import { createEmptySession } from './session-state';
import { addTrack } from './session-operations';

function initialSession() {
  return createEmptySession({ id: 'session-1' });
}

describe('createSessionStore', () => {
  it('exposes the initial session via getState', () => {
    const store = createSessionStore({ initialSession: initialSession() });

    expect(store.getState()).toEqual(initialSession());
  });

  it('applies a pure operation and replaces state immutably', () => {
    const store = createSessionStore({ initialSession: initialSession() });

    store.applyOperation((state) =>
      addTrack(state, { trackId: 'track-1', name: 'A' })
    );

    const next = store.getState();
    expect(next.trackOrder).toEqual(['track-1']);
    expect(initialSession().trackOrder).toEqual([]);
  });

  it('notifies subscribers when state changes', () => {
    const store = createSessionStore({ initialSession: initialSession() });
    const listener = vi.fn();
    store.subscribe(listener);

    store.applyOperation((state) =>
      addTrack(state, { trackId: 'track-1', name: 'A' })
    );

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns an unsubscribe function from subscribe', () => {
    const store = createSessionStore({ initialSession: initialSession() });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.applyOperation((state) =>
      addTrack(state, { trackId: 'track-1', name: 'A' })
    );

    expect(listener).not.toHaveBeenCalled();
  });
});

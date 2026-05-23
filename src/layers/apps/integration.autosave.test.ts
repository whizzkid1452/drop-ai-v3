import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '@/layers/composition/create-app';
import { FakeAudioProvider } from '@/layers/audio/fake-audio-provider';
import { MemorySessionStorage } from '@/layers/storage/memory-session-storage';

const NOW = '2026-05-23T00:00:00.000Z';
const DEBOUNCE_MS = 100;

function fixedIdGenerator() {
  const counters: Record<string, number> = {};
  return {
    next(prefix = 'id') {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
  };
}

function setup(storage = new MemorySessionStorage()) {
  return createApp({
    audioProvider: new FakeAudioProvider(),
    storage,
    idGenerator: fixedIdGenerator(),
    now: () => NOW,
    sessionId: 'session-1',
    autosave: { debounceMs: DEBOUNCE_MS },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createApp autosave wiring', () => {
  it('executing track.add triggers autosave after debounce', async () => {
    const storage = new MemorySessionStorage();
    const app = setup(storage);

    await app.controller.executeCommand({ type: 'track.add' });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    await vi.runAllTimersAsync();

    const loaded = await storage.loadLatest();
    expect(loaded?.trackOrder).toEqual(['track-1']);
  });

  it('repeated mutations debounce into a single save', async () => {
    const storage = new MemorySessionStorage();
    const saveSpy = vi.spyOn(storage, 'save');
    const app = setup(storage);

    await app.controller.executeCommand({ type: 'track.add' });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS / 2);
    await app.controller.executeCommand({ type: 'track.add' });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    await vi.runAllTimersAsync();

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('autosave can be disposed via app.dispose()', async () => {
    const storage = new MemorySessionStorage();
    const saveSpy = vi.spyOn(storage, 'save');
    const app = setup(storage);

    app.dispose();
    await app.controller.executeCommand({ type: 'track.add' });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('does not autosave when no autosave option is provided', async () => {
    const storage = new MemorySessionStorage();
    const saveSpy = vi.spyOn(storage, 'save');
    const app = createApp({
      audioProvider: new FakeAudioProvider(),
      storage,
      idGenerator: fixedIdGenerator(),
      now: () => NOW,
      sessionId: 'session-1',
    });

    await app.controller.executeCommand({ type: 'track.add' });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 5);

    expect(saveSpy).not.toHaveBeenCalled();
    expect(app.autosave).toBeUndefined();
  });
});

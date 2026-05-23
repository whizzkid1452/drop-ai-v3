import type { AudioProvider } from '@/layers/audio/audio-provider';
import { FakeAudioProvider } from '@/layers/audio/fake-audio-provider';
import { AppController } from '@/layers/controllers/app-controller';
import { AutosaveController } from '@/layers/controllers/autosave-controller';
import { createUuidGenerator, type IdGenerator } from '@/layers/controllers/id-generator';
import {
  systemNowProvider,
  type NowProvider,
} from '@/layers/controllers/now-provider';
import { PlaybackController } from '@/layers/controllers/playback-controller';
import { SessionPersistenceController } from '@/layers/controllers/session-persistence-controller';
import { TrackController } from '@/layers/controllers/track-controller';
import {
  createSessionStore,
  type SessionStore,
} from '@/layers/core/session/session-store';
import { createEmptySession } from '@/layers/core/session/session-state';
import { isIndexedDbAvailable } from '@/layers/storage/indexeddb/availability';
import { IndexedDbSessionStorage } from '@/layers/storage/indexeddb/indexed-db-session-storage';
import { MemorySessionStorage } from '@/layers/storage/memory-session-storage';
import type { SessionStorageProvider } from '@/layers/storage/session-storage-provider';

export interface CreateAppOptions {
  audioProvider?: AudioProvider;
  storage?: SessionStorageProvider;
  idGenerator?: IdGenerator;
  now?: NowProvider;
  sessionId?: string;
  autosave?: { debounceMs: number };
  indexedDbName?: string;
}

function resolveDefaultStorage(
  indexedDbName: string | undefined
): SessionStorageProvider {
  if (isIndexedDbAvailable()) {
    return new IndexedDbSessionStorage({ dbName: indexedDbName });
  }
  return new MemorySessionStorage();
}

export interface AppHandle {
  controller: AppController;
  sessionStore: SessionStore;
  audioProvider: AudioProvider;
  storage: SessionStorageProvider;
  autosave: AutosaveController | undefined;
  dispose: () => void;
}

const DEFAULT_SESSION_ID = 'session-1';

export function createApp(options: CreateAppOptions = {}): AppHandle {
  const audioProvider = options.audioProvider ?? new FakeAudioProvider();
  const storage =
    options.storage ?? resolveDefaultStorage(options.indexedDbName);
  const idGenerator = options.idGenerator ?? createUuidGenerator();
  const now = options.now ?? systemNowProvider;
  const sessionId = options.sessionId ?? DEFAULT_SESSION_ID;

  const sessionStore = createSessionStore({
    initialSession: createEmptySession({ id: sessionId, now: now() }),
  });

  const trackController = new TrackController({
    sessionStore,
    audioProvider,
    idGenerator,
    now,
  });

  const playbackController = new PlaybackController({
    sessionStore,
    audioProvider,
    now,
  });

  const sessionPersistenceController = new SessionPersistenceController({
    sessionStore,
    storage,
    audioProvider,
  });

  const controller = new AppController({
    playbackController,
    trackController,
    sessionPersistenceController,
  });

  let autosaveController: AutosaveController | undefined;
  if (options.autosave) {
    autosaveController = new AutosaveController({
      sessionStore,
      saveSession: () => sessionPersistenceController.saveSession(),
      debounceMs: options.autosave.debounceMs,
    });
  }

  return {
    controller,
    sessionStore,
    audioProvider,
    storage,
    autosave: autosaveController,
    dispose: () => {
      autosaveController?.dispose();
    },
  };
}

import type { AudioProvider } from '@/layers/audio/audio-provider';
import { FakeAudioProvider } from '@/layers/audio/fake-audio-provider';
import { AppController } from '@/layers/controllers/app-controller';
import { createUuidGenerator, type IdGenerator } from '@/layers/controllers/id-generator';
import { PlaybackController } from '@/layers/controllers/playback-controller';
import { SessionExportController } from '@/layers/controllers/session-export-controller';
import { TrackController } from '@/layers/controllers/track-controller';
import {
  createSessionStore,
  type SessionStore,
} from '@/layers/core/session/session-store';
import { createEmptySession } from '@/layers/core/session/session-state';

export interface CreateAppOptions {
  audioProvider?: AudioProvider;
  idGenerator?: IdGenerator;
  sessionId?: string;
}

export interface AppHandle {
  controller: AppController;
  sessionStore: SessionStore;
  audioProvider: AudioProvider;
  dispose: () => void;
}

const DEFAULT_SESSION_ID = 'session-1';

export function createApp(options: CreateAppOptions = {}): AppHandle {
  const audioProvider = options.audioProvider ?? new FakeAudioProvider();
  const idGenerator = options.idGenerator ?? createUuidGenerator();
  const sessionId = options.sessionId ?? DEFAULT_SESSION_ID;

  const sessionStore = createSessionStore({
    initialSession: createEmptySession({ id: sessionId }),
  });

  const trackController = new TrackController({
    sessionStore,
    audioProvider,
    idGenerator,
  });

  const playbackController = new PlaybackController({
    sessionStore,
    audioProvider,
  });

  const sessionExportController = new SessionExportController({
    sessionStore,
    audioProvider,
  });

  const controller = new AppController({
    playbackController,
    trackController,
    sessionExportController,
  });

  return {
    controller,
    sessionStore,
    audioProvider,
    dispose: () => undefined,
  };
}

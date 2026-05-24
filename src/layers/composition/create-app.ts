import type { IAudioEngine } from '@/layers/audio-engine/audio-engine';
import { FakeAudioEngine } from '@/layers/audio-engine/fake-audio-engine';
import { AppController } from '@/layers/controllers/app-controller';
import {
  createUuidGenerator,
  type IdGenerator,
} from '@/layers/controllers/id-generator';
import { PlaybackController } from '@/layers/controllers/playback-controller';
import { SessionExportController } from '@/layers/controllers/session-export-controller';
import { TrackController } from '@/layers/controllers/track-controller';
import {
  createSessionStore,
  type ISessionReader,
  type ISessionStore,
} from '@/layers/session/session-store';
import { createEmptySession } from '@/layers/session/session-state';

export interface ICreateAppOptions {
  audioEngine?: IAudioEngine;
  idGenerator?: IdGenerator;
  sessionId?: string;
}

export interface IComposeAppDependencies {
  sessionStore: ISessionStore;
  audioEngine: IAudioEngine;
  idGenerator: IdGenerator;
}

export interface IAppHandle {
  controller: AppController;
  sessionReader: ISessionReader;
  dispose: () => void;
}

const DEFAULT_SESSION_ID = 'session-1';

export function composeApp({
  sessionStore,
  audioEngine,
  idGenerator,
}: IComposeAppDependencies): IAppHandle {
  const sessionReader: ISessionReader = {
    getState: () => sessionStore.getState(),
    subscribe: (listener) => sessionStore.subscribe(listener),
  };
  const trackController = new TrackController({
    sessionStore,
    audioEngine,
    idGenerator,
  });

  const playbackController = new PlaybackController({
    sessionStore,
    audioEngine,
  });

  const sessionExportController = new SessionExportController({
    sessionStore,
    audioEngine,
  });

  const controller = new AppController({
    playbackController,
    trackController,
    sessionExportController,
  });

  return {
    controller,
    sessionReader,
    dispose: () => undefined,
  };
}

export function createApp(options: ICreateAppOptions = {}): IAppHandle {
  const audioEngine = options.audioEngine ?? new FakeAudioEngine();
  const idGenerator = options.idGenerator ?? createUuidGenerator();
  const sessionId = options.sessionId ?? DEFAULT_SESSION_ID;
  const sessionStore = createSessionStore({
    initialSession: createEmptySession({ id: sessionId }),
  });

  return composeApp({ sessionStore, audioEngine, idGenerator });
}

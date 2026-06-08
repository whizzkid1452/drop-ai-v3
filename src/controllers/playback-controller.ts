import type { IAudioEngine } from '@/audio-engine/audio-engine';
import { sessionOps } from '@/session/session-operations';
import type { ISessionStore } from '@/session/session-store';
import type {
  PlaybackCommandTarget,
  PlaybackLoopInput,
} from './command-controller';
import { commitSession } from './commit-session';

export interface PlaybackControllerDependencies {
  sessionStore: ISessionStore;
  audioEngine: IAudioEngine;
}

export class PlaybackController implements PlaybackCommandTarget {
  private readonly sessionStore: ISessionStore;
  private readonly audioEngine: IAudioEngine;

  constructor(deps: PlaybackControllerDependencies) {
    this.sessionStore = deps.sessionStore;
    this.audioEngine = deps.audioEngine;
  }

  async handlePlay(): Promise<void> {
    await this.audioEngine.play();
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPlaying(state, { playing: true })
    );
  }

  handlePause(): void {
    const nextState = sessionOps.setPlaying(this.sessionStore.getState(), {
      playing: false,
    });

    this.audioEngine.pause();
    commitSession(this.sessionStore, nextState);
  }

  handleStop(): void {
    const nextState = sessionOps.setPosition(
      sessionOps.setPlaying(this.sessionStore.getState(), { playing: false }),
      {
        positionSeconds: 0,
      }
    );

    this.audioEngine.stop();
    commitSession(this.sessionStore, nextState);
  }

  handleSeek(seconds: number): void {
    const nextState = sessionOps.setPosition(this.sessionStore.getState(), {
      positionSeconds: seconds,
    });

    this.audioEngine.seek(seconds);
    commitSession(this.sessionStore, nextState);
  }

  handleLoop({ start, end, enabled }: PlaybackLoopInput): void {
    const nextState = sessionOps.setLoop(this.sessionStore.getState(), {
      start,
      end,
      enabled,
    });

    this.audioEngine.setLoop({ start, end, enabled });
    commitSession(this.sessionStore, nextState);
  }

  handleBpm(bpm: number): void {
    const nextState = sessionOps.setBpm(this.sessionStore.getState(), { bpm });

    this.audioEngine.setBpm(bpm);
    commitSession(this.sessionStore, nextState);
  }

  handleMasterVolume(volume: number): void {
    const nextState = sessionOps.setMasterVolume(this.sessionStore.getState(), {
      volume,
    });

    this.audioEngine.setMasterVolume(volume);
    commitSession(this.sessionStore, nextState);
  }
}

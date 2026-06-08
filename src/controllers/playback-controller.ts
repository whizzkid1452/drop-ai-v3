import type { IAudioEngine } from '@/audio-engine/audio-engine';
import { sessionOps } from '@/session/session-operations';
import type { ISessionStore } from '@/session/session-store';
import type {
  PlaybackCommandTarget,
  PlaybackLoopInput,
} from './command-controller';

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
    this.audioEngine.pause();
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPlaying(state, { playing: false })
    );
  }

  handleStop(): void {
    this.audioEngine.stop();
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPosition(sessionOps.setPlaying(state, { playing: false }), {
        positionSeconds: 0,
      })
    );
  }

  handleSeek(seconds: number): void {
    this.audioEngine.seek(seconds);
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPosition(state, { positionSeconds: seconds })
    );
  }

  handleLoop({ start, end, enabled }: PlaybackLoopInput): void {
    this.audioEngine.setLoop({ start, end, enabled });
    this.sessionStore.applyOperation((state) =>
      sessionOps.setLoop(state, { start, end, enabled })
    );
  }

  handleBpm(bpm: number): void {
    this.audioEngine.setBpm(bpm);
    this.sessionStore.applyOperation((state) =>
      sessionOps.setBpm(state, { bpm })
    );
  }

  handleMasterVolume(volume: number): void {
    this.audioEngine.setMasterVolume(volume);
    this.sessionStore.applyOperation((state) =>
      sessionOps.setMasterVolume(state, { volume })
    );
  }
}

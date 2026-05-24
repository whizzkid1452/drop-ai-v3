import type { IAudioEngine } from '@/layers/audio-engine/audio-engine';
import { sessionOps } from '@/layers/session/session-operations';
import type { ISessionStore } from '@/layers/session/session-store';
import type { PlaybackCommandTarget } from './command-controller';

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
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPlaying(state, { playing: true })
    );
    await this.audioEngine.play();
  }

  handlePause(): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPlaying(state, { playing: false })
    );
    this.audioEngine.pause();
  }

  handleStop(): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPosition(sessionOps.setPlaying(state, { playing: false }), {
        positionSeconds: 0,
      })
    );
    this.audioEngine.stop();
  }

  handleSeek(seconds: number): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPosition(state, { positionSeconds: seconds })
    );
    this.audioEngine.seek(seconds);
  }

  handleLoop(start: number, end: number, enabled: boolean): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setLoop(state, { start, end, enabled })
    );
    this.audioEngine.setLoop({ start, end, enabled });
  }

  handleBpm(bpm: number): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setBpm(state, { bpm })
    );
    this.audioEngine.setBpm(bpm);
  }

  handleMasterVolume(volume: number): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setMasterVolume(state, { volume })
    );
    this.audioEngine.setMasterVolume(volume);
  }
}

import type { AudioProvider } from '@/layers/audio/audio-provider';
import { sessionOps } from '@/layers/core/session/session-operations';
import type { SessionStore } from '@/layers/core/session/session-store';
import type { PlaybackCommandTarget } from './command-controller';

export interface PlaybackControllerDependencies {
  sessionStore: SessionStore;
  audioProvider: AudioProvider;
}

export class PlaybackController implements PlaybackCommandTarget {
  private readonly sessionStore: SessionStore;
  private readonly audioProvider: AudioProvider;

  constructor(deps: PlaybackControllerDependencies) {
    this.sessionStore = deps.sessionStore;
    this.audioProvider = deps.audioProvider;
  }

  async handlePlay(): Promise<void> {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPlaying(state, { playing: true })
    );
    await this.audioProvider.play();
  }

  handlePause(): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPlaying(state, { playing: false })
    );
    this.audioProvider.pause();
  }

  handleStop(): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPosition(sessionOps.setPlaying(state, { playing: false }), {
        positionSeconds: 0,
      })
    );
    this.audioProvider.stop();
  }

  handleSeek(seconds: number): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setPosition(state, { positionSeconds: seconds })
    );
    this.audioProvider.seek(seconds);
  }

  handleLoop(start: number, end: number, enabled: boolean): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setLoop(state, { start, end, enabled })
    );
    this.audioProvider.setLoop({ start, end, enabled });
  }

  handleBpm(bpm: number): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setBpm(state, { bpm })
    );
    this.audioProvider.setBpm(bpm);
  }

  handleMasterVolume(volume: number): void {
    this.sessionStore.applyOperation((state) =>
      sessionOps.setMasterVolume(state, { volume })
    );
    this.audioProvider.setMasterVolume(volume);
  }
}

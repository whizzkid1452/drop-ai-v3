import type { IAudioEngine } from '@/audio-engine/audio-engine';
import { sessionOps } from '@/session/session-operations';
import type { SessionState, TrackState } from '@/session/session-state';
import type { ISessionStore } from '@/session/session-store';
import type { ExportRangeCommandTarget } from './command-controller';
import type { SessionExportResult } from './command-result';
import { commitSession } from './commit-session';

export interface ExportRangeControllerDependencies {
  audioEngine: IAudioEngine;
  sessionStore: ISessionStore;
}

export class ExportRangeController implements ExportRangeCommandTarget {
  private readonly audioEngine: IAudioEngine;
  private readonly sessionStore: ISessionStore;

  constructor({
    audioEngine,
    sessionStore,
  }: ExportRangeControllerDependencies) {
    this.audioEngine = audioEngine;
    this.sessionStore = sessionStore;
  }

  setExportRangeStart(seconds: number): void {
    const nextState = sessionOps.setExportRangeStart(
      this.sessionStore.getState(),
      { seconds }
    );

    commitSession(this.sessionStore, nextState);
  }

  setExportRangeEnd(seconds: number): void {
    const nextState = sessionOps.setExportRangeEnd(
      this.sessionStore.getState(),
      { seconds }
    );

    commitSession(this.sessionStore, nextState);
  }

  setExportRangeFadeIn(seconds: number): void {
    const nextState = sessionOps.setExportRangeFadeIn(
      this.sessionStore.getState(),
      { seconds }
    );

    commitSession(this.sessionStore, nextState);
  }

  setExportRangeFadeOut(seconds: number): void {
    const nextState = sessionOps.setExportRangeFadeOut(
      this.sessionStore.getState(),
      { seconds }
    );

    commitSession(this.sessionStore, nextState);
  }

  async previewExportRange(): Promise<void> {
    const snapshot = this.sessionStore.getState();
    const { startSeconds, endSeconds } = snapshot.exportRange;
    const nextState = sessionOps.setPlaying(
      sessionOps.setLoop(
        sessionOps.setPosition(snapshot, { positionSeconds: startSeconds }),
        { enabled: true, end: endSeconds, start: startSeconds }
      ),
      { playing: true }
    );

    this.audioEngine.seek(startSeconds);
    this.audioEngine.setLoop({
      enabled: true,
      end: endSeconds,
      start: startSeconds,
    });
    await this.audioEngine.play();
    commitSession(this.sessionStore, nextState);
  }

  async exportRange(filename?: string): Promise<SessionExportResult> {
    const snapshot = this.sessionStore.getState();
    const { startSeconds, endSeconds, fadeInSeconds, fadeOutSeconds } =
      snapshot.exportRange;
    const durationSeconds = endSeconds - startSeconds;

    if (!hasRegionIntersection(snapshot, startSeconds, endSeconds)) {
      throw new Error('Cannot export an empty range.');
    }

    const blob = await this.audioEngine.exportSessionRange({
      durationSeconds,
      endSeconds,
      fadeInSeconds,
      fadeOutSeconds,
      session: snapshot,
      startSeconds,
    });

    return {
      blob,
      filename: filename ?? `${snapshot.id}-range.wav`,
    };
  }
}

function hasRegionIntersection(
  session: SessionState,
  startSeconds: number,
  endSeconds: number
): boolean {
  for (const trackId of session.trackOrder) {
    const track: TrackState = session.tracksById[trackId];
    for (const regionId of track.regionOrder) {
      const region = track.regionsById[regionId];
      const regionEnd = region.startTime + region.duration;
      if (
        Math.max(region.startTime, startSeconds) <
        Math.min(regionEnd, endSeconds)
      ) {
        return true;
      }
    }
  }

  return false;
}

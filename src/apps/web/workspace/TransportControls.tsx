import { useMemo, useState } from 'react';
import { useAppController } from '../AppProvider';
import type { WebSessionState } from '../AppProvider';
import * as styles from '../App.css';

export interface TransportControlsProps {
  session: WebSessionState;
}

type TransportAction = 'play' | 'pause' | 'stop' | 'seek';

export function TransportControls({ session }: TransportControlsProps) {
  const controller = useAppController();
  const [pendingAction, setPendingAction] = useState<TransportAction | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const durationSeconds = useMemo(
    () => computeSessionDuration(session),
    [session]
  );
  const maxSeekSeconds = Math.max(1, durationSeconds);
  const positionSeconds = Math.min(
    session.playback.positionSeconds,
    maxSeekSeconds
  );

  async function runTransportAction(
    action: TransportAction,
    seconds?: number
  ): Promise<void> {
    setPendingAction(action);
    setErrorMessage(null);

    const result =
      action === 'seek'
        ? await controller.executeCommand({
            type: 'playback.seek',
            payload: { seconds: clampSeek(seconds ?? 0, maxSeekSeconds) },
          })
        : await controller.executeCommand(commandForAction(action));

    setPendingAction(null);

    if (!result.ok) {
      setErrorMessage(result.error.message);
    }
  }

  return (
    <section className={styles.transportPanel} aria-label="Transport controls">
      <div className={styles.transportHeader}>
        <h2 className={styles.sectionTitle}>Transport</h2>
        <p className={styles.transportTime} data-testid="transport-time">
          {formatTime(positionSeconds)} / {formatTime(durationSeconds)}
        </p>
      </div>
      <div className={styles.transportButtonRow}>
        <button
          aria-label="Play"
          aria-pressed={session.playback.playing}
          className={styles.transportIconButton}
          data-testid="transport-play"
          disabled={pendingAction !== null || session.playback.playing}
          title="Play"
          type="button"
          onClick={() => void runTransportAction('play')}
        >
          <span className={styles.playIcon} aria-hidden="true" />
        </button>
        <button
          aria-label="Pause"
          className={styles.transportIconButton}
          data-testid="transport-pause"
          disabled={pendingAction !== null || !session.playback.playing}
          title="Pause"
          type="button"
          onClick={() => void runTransportAction('pause')}
        >
          <span className={styles.pauseIcon} aria-hidden="true">
            <span className={styles.pauseBar} />
            <span className={styles.pauseBar} />
          </span>
        </button>
        <button
          aria-label="Stop"
          className={styles.transportIconButton}
          data-testid="transport-stop"
          disabled={pendingAction !== null}
          title="Stop"
          type="button"
          onClick={() => void runTransportAction('stop')}
        >
          <span className={styles.stopIcon} aria-hidden="true" />
        </button>
      </div>
      <label className={styles.seekControl}>
        <span className={styles.summaryLabel}>Position</span>
        <input
          aria-label="Seek position"
          className={styles.seekSlider}
          data-testid="transport-seek"
          max={maxSeekSeconds}
          min={0}
          step={0.01}
          type="range"
          value={positionSeconds}
          onInput={(event) =>
            void runTransportAction('seek', event.currentTarget.valueAsNumber)
          }
        />
      </label>
      <label className={styles.seekNumberControl}>
        <span className={styles.summaryLabel}>Seconds</span>
        <input
          aria-label="Seek seconds"
          className={styles.seekNumberInput}
          data-testid="transport-seek-seconds"
          max={maxSeekSeconds}
          min={0}
          step={0.01}
          type="number"
          value={Number(positionSeconds.toFixed(2))}
          onInput={(event) =>
            void runTransportAction('seek', event.currentTarget.valueAsNumber)
          }
        />
      </label>
      {errorMessage ? (
        <p className={styles.transportError} data-testid="transport-error">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

function commandForAction(action: Exclude<TransportAction, 'seek'>) {
  switch (action) {
    case 'play':
      return { type: 'playback.play' } as const;
    case 'pause':
      return { type: 'playback.pause' } as const;
    case 'stop':
      return { type: 'playback.stop' } as const;
  }
}

function computeSessionDuration(session: WebSessionState): number {
  let max = 0;
  for (const trackId of session.trackOrder) {
    const track = session.tracksById[trackId];
    for (const regionId of track.regionOrder) {
      const region = track.regionsById[regionId];
      const end = region.startTime + region.duration;
      if (end > max) {
        max = end;
      }
    }
  }
  return max;
}

function clampSeek(seconds: number, maxSeconds: number): number {
  if (!Number.isFinite(seconds)) {
    return 0;
  }
  return Math.min(Math.max(seconds, 0), maxSeconds);
}

function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

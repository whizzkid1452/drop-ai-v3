import type { WebSessionState } from '../AppProvider';
import type { UploadedSessionInfo } from '../upload/upload-session-flow';
import * as styles from '../App.css';

export interface SessionSummaryProps {
  session: WebSessionState;
  uploadInfo: UploadedSessionInfo;
}

export function SessionSummary({ session, uploadInfo }: SessionSummaryProps) {
  const tracks = session.trackOrder.map(
    (trackId) => session.tracksById[trackId]
  );

  return (
    <section className={styles.panel} aria-label="Session summary">
      <h2 className={styles.sectionTitle}>Session</h2>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Session</span>
          <p className={styles.summaryValue} data-testid="session-id">
            {session.id}
          </p>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Tracks</span>
          <p className={styles.summaryValue} data-testid="track-count">
            {tracks.length}
          </p>
        </div>
      </div>
      <p className={styles.commandMessage} data-testid="command-message">
        Imported {uploadInfo.filename} as {uploadInfo.assetId}. Start with
        commands or session export.
      </p>
      <ul className={styles.trackList} data-testid="track-list">
        {tracks.map((track) => (
          <li
            className={styles.trackRow}
            data-testid="track-row"
            key={track.id}
          >
            {track.name}
          </li>
        ))}
      </ul>
    </section>
  );
}

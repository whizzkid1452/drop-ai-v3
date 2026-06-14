import { lazy, Suspense, useState } from 'react';
import { useAppController, useSessionState } from './AppProvider';
import * as styles from './App.css';

const CliTerminal = lazy(() =>
  import('./cli/CliTerminal').then((module) => ({
    default: module.CliTerminal,
  }))
);

export default function App() {
  const controller = useAppController();
  const session = useSessionState();
  const [commandMessage, setCommandMessage] = useState('Ready');
  const tracks = session.trackOrder.map(
    (trackId) => session.tracksById[trackId]
  );

  async function handleAddTrack() {
    const result = await controller.executeCommand({ type: 'track.add' });

    if (result.ok) {
      setCommandMessage(`Added ${result.data.id}`);
      return;
    }

    setCommandMessage(result.error.message);
  }

  return (
    <main className={styles.appShell} data-testid="app-shell">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Command-first DAW shell</p>
          <h1 className={styles.title}>Drop AI v3</h1>
          <p className={styles.subtitle}>
            Browser UI reads the session state and sends write actions through
            the command boundary.
          </p>
        </div>
        <button
          className={styles.primaryButton}
          data-testid="add-track"
          type="button"
          onClick={handleAddTrack}
        >
          Add Track
        </button>
      </header>
      <div className={styles.layoutGrid}>
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
            {commandMessage}
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
        <section className={styles.terminalPanel} aria-label="CLI terminal">
          <h2 className={styles.sectionTitle}>CLI</h2>
          <Suspense
            fallback={
              <p className={styles.loading} data-testid="cli-terminal-loading">
                Loading CLI
              </p>
            }
          >
            <CliTerminal />
          </Suspense>
        </section>
      </div>
    </main>
  );
}

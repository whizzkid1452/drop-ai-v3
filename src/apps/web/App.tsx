import { lazy, Suspense, useState } from 'react';
import { useAppController, useSessionState } from './AppProvider';
import { UploadDropzone } from './upload/UploadDropzone';
import * as styles from './App.css';

const CliTerminal = lazy(() =>
  import('./cli/CliTerminal').then((module) => ({
    default: module.CliTerminal,
  }))
);

export interface UploadedSessionInfo {
  assetId: string;
  duration: number;
  filename: string;
  regionId: string;
  trackId: string;
}

type UploadFlowState =
  | { status: 'empty' }
  | { status: 'uploading'; filename: string }
  | { status: 'failed'; message: string }
  | ({ status: 'ready' } & UploadedSessionInfo);

export default function App() {
  const controller = useAppController();
  const session = useSessionState();
  const [uploadFlow, setUploadFlow] = useState<UploadFlowState>({
    status: 'empty',
  });
  const tracks = session.trackOrder.map(
    (trackId) => session.tracksById[trackId]
  );

  async function handleFileAccepted(file: File): Promise<void> {
    setUploadFlow({ status: 'uploading', filename: file.name });

    const assetResult = await controller.executeCommand({
      type: 'asset.register',
      payload: { file },
    });

    if (!assetResult.ok) {
      setUploadFlow({ status: 'failed', message: assetResult.error.message });
      return;
    }

    const trackResult = await controller.executeCommand({ type: 'track.add' });

    if (!trackResult.ok) {
      setUploadFlow({ status: 'failed', message: trackResult.error.message });
      return;
    }

    const regionResult = await controller.executeCommand({
      type: 'region.add',
      payload: {
        assetId: assetResult.data.id,
        startTime: 0,
        trackId: trackResult.data.id,
      },
    });

    if (!regionResult.ok) {
      setUploadFlow({ status: 'failed', message: regionResult.error.message });
      return;
    }

    setUploadFlow({
      status: 'ready',
      assetId: assetResult.data.id,
      duration: assetResult.data.duration,
      filename: file.name,
      regionId: regionResult.data.id,
      trackId: trackResult.data.id,
    });
  }

  if (uploadFlow.status !== 'ready') {
    return (
      <main className={styles.appShell} data-testid="app-shell">
        <UploadDropzone
          disabled={uploadFlow.status === 'uploading'}
          errorMessage={
            uploadFlow.status === 'failed' ? uploadFlow.message : undefined
          }
          onFileAccepted={(file) => {
            void handleFileAccepted(file);
          }}
        />
      </main>
    );
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
            Imported {uploadFlow.filename} as {uploadFlow.assetId}. Start with
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
        <section className={styles.terminalPanel} aria-label="CLI terminal">
          <h2 className={styles.sectionTitle}>CLI</h2>
          <Suspense
            fallback={
              <p className={styles.loading} data-testid="cli-terminal-loading">
                Loading CLI
              </p>
            }
          >
            <CliTerminal uploadInfo={uploadFlow} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}

import { lazy, Suspense } from 'react';
import type { WebSessionState } from '../AppProvider';
import type { UploadedSessionInfo } from '../upload/upload-session-flow';
import * as styles from '../App.css';
import { SessionSummary } from './SessionSummary';
import { TransportControls } from './TransportControls';

const CliTerminal = lazy(() =>
  import('../cli/CliTerminal').then((module) => ({
    default: module.CliTerminal,
  }))
);

export interface WorkspaceScreenProps {
  session: WebSessionState;
  uploadInfo: UploadedSessionInfo;
}

export function WorkspaceScreen({ session, uploadInfo }: WorkspaceScreenProps) {
  return (
    <>
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
        <div className={styles.sidePanelStack}>
          <TransportControls session={session} />
          <SessionSummary session={session} uploadInfo={uploadInfo} />
        </div>
        <section className={styles.terminalPanel} aria-label="CLI terminal">
          <h2 className={styles.sectionTitle}>CLI</h2>
          <Suspense
            fallback={
              <p className={styles.loading} data-testid="cli-terminal-loading">
                Loading CLI
              </p>
            }
          >
            <CliTerminal uploadInfo={uploadInfo} />
          </Suspense>
        </section>
      </div>
    </>
  );
}

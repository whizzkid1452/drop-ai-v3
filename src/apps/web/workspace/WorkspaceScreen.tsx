import { lazy, Suspense, useState } from 'react';
import { AgentPanel } from '../agent/AgentPanel';
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

type WorkspacePanelTab = 'chat' | 'cli';

export function WorkspaceScreen({ session, uploadInfo }: WorkspaceScreenProps) {
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [selectedPanelTab, setSelectedPanelTab] =
    useState<WorkspacePanelTab>('chat');

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
        <button
          className={styles.secondaryButton}
          data-testid="right-panel-open"
          type="button"
          onClick={() => setIsRightPanelOpen(true)}
        >
          Panel
        </button>
      </header>
      <div
        className={
          isRightPanelOpen
            ? styles.workspaceGridWithPanel
            : styles.workspaceGrid
        }
      >
        <section className={styles.dawPanel} aria-label="DAW workspace">
          <div className={styles.dawPanelHeader}>
            <h2 className={styles.sectionTitle}>Workspace</h2>
            <p className={styles.agentStatus} data-testid="right-panel-status">
              {isRightPanelOpen ? 'Panel open' : 'Panel closed'}
            </p>
          </div>
          <div className={styles.dawPanelGrid}>
            <TransportControls session={session} />
            <SessionSummary session={session} uploadInfo={uploadInfo} />
          </div>
        </section>
        {isRightPanelOpen ? (
          <aside
            className={styles.rightPanel}
            aria-label="Right command panel"
            data-testid="right-panel"
          >
            <div className={styles.rightPanelHeader}>
              <h2 className={styles.sectionTitle}>Command</h2>
              <button
                className={styles.secondaryButton}
                data-testid="right-panel-close"
                type="button"
                onClick={() => setIsRightPanelOpen(false)}
              >
                Close
              </button>
            </div>
            <div className={styles.panelTabList} role="tablist">
              <button
                aria-selected={selectedPanelTab === 'chat'}
                className={styles.panelTabButton}
                data-testid="right-panel-chat-tab"
                role="tab"
                type="button"
                onClick={() => setSelectedPanelTab('chat')}
              >
                Chat
              </button>
              <button
                aria-selected={selectedPanelTab === 'cli'}
                className={styles.panelTabButton}
                data-testid="right-panel-cli-tab"
                role="tab"
                type="button"
                onClick={() => setSelectedPanelTab('cli')}
              >
                CLI
              </button>
            </div>
            {selectedPanelTab === 'chat' ? (
              <AgentPanel />
            ) : (
              <section aria-label="CLI terminal">
                <Suspense
                  fallback={
                    <p
                      className={styles.loading}
                      data-testid="cli-terminal-loading"
                    >
                      Loading CLI
                    </p>
                  }
                >
                  <CliTerminal uploadInfo={uploadInfo} />
                </Suspense>
              </section>
            )}
          </aside>
        ) : null}
      </div>
    </>
  );
}

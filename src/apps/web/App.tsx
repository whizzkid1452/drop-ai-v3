import { useAppController, useSessionState } from './AppProvider';
import { UploadDropzone } from './upload/UploadDropzone';
import { useUploadSessionFlow } from './upload/use-upload-session-flow';
import { WorkspaceScreen } from './workspace/WorkspaceScreen';
import * as styles from './App.css';

export default function App() {
  const controller = useAppController();
  const session = useSessionState();
  const { uploadFlow, handleFileAccepted } = useUploadSessionFlow(controller);

  if (uploadFlow.status !== 'ready') {
    return (
      <main className={styles.appShell} data-testid="app-shell">
        <UploadDropzone
          disabled={uploadFlow.status === 'uploading'}
          errorMessage={
            uploadFlow.status === 'failed' ? uploadFlow.message : undefined
          }
          onFileAccepted={handleFileAccepted}
        />
      </main>
    );
  }

  return (
    <main className={styles.appShell} data-testid="app-shell">
      <WorkspaceScreen session={session} uploadInfo={uploadFlow} />
    </main>
  );
}

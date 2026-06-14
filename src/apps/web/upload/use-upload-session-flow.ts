import { useCallback, useState } from 'react';
import type { AppController } from '@/controllers';
import {
  uploadFileToSession,
  type UploadFlowState,
} from './upload-session-flow';

export interface UseUploadSessionFlowResult {
  uploadFlow: UploadFlowState;
  handleFileAccepted: (file: File) => void;
}

export function useUploadSessionFlow(
  controller: AppController
): UseUploadSessionFlowResult {
  const [uploadFlow, setUploadFlow] = useState<UploadFlowState>({
    status: 'empty',
  });

  const handleFileAccepted = useCallback(
    (file: File): void => {
      setUploadFlow({ status: 'uploading', filename: file.name });

      void uploadFileToSession(file, controller)
        .then((result) => {
          if (!result.ok) {
            setUploadFlow({ status: 'failed', message: result.message });
            return;
          }

          setUploadFlow({ status: 'ready', ...result.uploadInfo });
        })
        .catch((error: unknown) => {
          setUploadFlow({ status: 'failed', message: toErrorMessage(error) });
        });
    },
    [controller]
  );

  return { uploadFlow, handleFileAccepted };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Upload failed.';
}

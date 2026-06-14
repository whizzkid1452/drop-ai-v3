import type { AppController } from '@/controllers';

export interface UploadedSessionInfo {
  assetId: string;
  duration: number;
  filename: string;
  regionId: string;
  trackId: string;
}

export type UploadFlowState =
  | { status: 'empty' }
  | { status: 'uploading'; filename: string }
  | { status: 'failed'; message: string }
  | ({ status: 'ready' } & UploadedSessionInfo);

export type UploadSessionResult =
  | { ok: true; uploadInfo: UploadedSessionInfo }
  | { ok: false; message: string };

export async function uploadFileToSession(
  file: File,
  controller: AppController
): Promise<UploadSessionResult> {
  const assetResult = await controller.executeCommand({
    type: 'asset.register',
    payload: { file },
  });

  if (!assetResult.ok) {
    return failure(assetResult.error.message);
  }

  const trackResult = await controller.executeCommand({ type: 'track.add' });

  if (!trackResult.ok) {
    return failure(trackResult.error.message);
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
    return failure(regionResult.error.message);
  }

  return {
    ok: true,
    uploadInfo: {
      assetId: assetResult.data.id,
      duration: assetResult.data.duration,
      filename: file.name,
      regionId: regionResult.data.id,
      trackId: trackResult.data.id,
    },
  };
}

function failure(message: string): UploadSessionResult {
  return { ok: false, message };
}

import type { WebSessionState } from '../AppProvider';
import type { UploadedSessionInfo } from '../upload/upload-session-flow';

export function formatSessionStatus(session: WebSessionState): string {
  const regionCount = session.trackOrder.reduce((count, trackId) => {
    return count + session.tracksById[trackId].regionOrder.length;
  }, 0);

  return [
    `Session: ${session.id}`,
    `Tracks: ${session.trackOrder.length}`,
    `Regions: ${regionCount}`,
    `Playing: ${session.playback.playing ? 'yes' : 'no'}`,
    `Position: ${session.playback.positionSeconds}s`,
    `Export range: ${session.exportRange.startSeconds}s -> ${session.exportRange.endSeconds}s`,
  ].join('\n');
}

export function createCliWelcomeText(uploadInfo: UploadedSessionInfo): string {
  return [
    'Drop AI CLI',
    '',
    'Uploaded:',
    `  file: ${uploadInfo.filename}`,
    `  assetId: ${uploadInfo.assetId}`,
    `  trackId: ${uploadInfo.trackId}`,
    `  regionId: ${uploadInfo.regionId}`,
    `  duration: ${uploadInfo.duration}s`,
    '',
    'Start:',
    '  commands',
    `  region split ${uploadInfo.trackId} ${uploadInfo.regionId} 1`,
    `  session export ${uploadInfo.filename.replace(/\.[^.]*$/, '')}.wav`,
    '',
    'Help:',
    '  help',
    '  status',
  ].join('\r\n');
}

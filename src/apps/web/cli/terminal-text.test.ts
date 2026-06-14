import { describe, expect, it } from 'vitest';
import type { WebSessionState } from '../AppProvider';
import { createCliWelcomeText, formatSessionStatus } from './terminal-text';

describe('terminal text', () => {
  it('formats session status with track and region counts', () => {
    const session: WebSessionState = {
      id: 'session-1',
      playback: {
        bpm: 120,
        loop: { enabled: false, end: 4, start: 0 },
        masterVolume: 1,
        playing: true,
        positionSeconds: 1.5,
      },
      trackOrder: ['track-1'],
      tracksById: {
        'track-1': {
          id: 'track-1',
          muted: false,
          name: 'Track 1',
          pan: 0,
          regionOrder: ['region-1', 'region-2'],
          regionsById: {},
          soloed: false,
          volume: 1,
        },
      },
    };

    expect(formatSessionStatus(session)).toBe(
      [
        'Session: session-1',
        'Tracks: 1',
        'Regions: 2',
        'Playing: yes',
        'Position: 1.5s',
      ].join('\n')
    );
  });

  it('formats the initial terminal welcome text from upload info', () => {
    expect(
      createCliWelcomeText({
        assetId: 'asset-1',
        duration: 4,
        filename: 'loop.wav',
        regionId: 'region-1',
        trackId: 'track-1',
      })
    ).toContain('session export loop.wav');
  });
});

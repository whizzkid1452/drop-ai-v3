import { describe, expect, it } from 'vitest';
import { createAgentSessionSummary } from './agent-session-summary';
import type { SessionState } from '@/session/session-state';

describe('createAgentSessionSummary', () => {
  it('summarizes tracks, regions, playback, and export range in session order', () => {
    const session = createSession();

    expect(createAgentSessionSummary(session)).toEqual({
      exportRange: {
        endSeconds: 3,
        fadeInSeconds: 0.1,
        fadeOutSeconds: 0.2,
        startSeconds: 1,
      },
      playback: {
        bpm: 120,
        loop: {
          enabled: true,
          end: 3,
          start: 1,
        },
        masterVolume: 0.8,
        playing: true,
        positionSeconds: 1.5,
      },
      sessionId: 'session-1',
      tracks: [
        {
          id: 'track-2',
          muted: true,
          name: 'Track 2',
          pan: -0.25,
          regions: [
            {
              assetId: 'asset-2',
              duration: 1.5,
              id: 'region-2',
              offset: 0.5,
              startTime: 1,
            },
          ],
          soloed: false,
          volume: 0.5,
        },
        {
          id: 'track-1',
          muted: false,
          name: 'Track 1',
          pan: 0.25,
          regions: [
            {
              assetId: 'asset-1',
              duration: 2,
              id: 'region-1',
              offset: 0,
              startTime: 0,
            },
          ],
          soloed: true,
          volume: 0.75,
        },
      ],
    });
  });

  it('returns JSON-compatible data', () => {
    const summary = createAgentSessionSummary(createSession());

    expect(() => JSON.stringify(summary)).not.toThrow();
    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  });
});

function createSession(): SessionState {
  return {
    exportRange: {
      endSeconds: 3,
      fadeInSeconds: 0.1,
      fadeOutSeconds: 0.2,
      startSeconds: 1,
    },
    id: 'session-1',
    playback: {
      bpm: 120,
      loop: {
        enabled: true,
        end: 3,
        start: 1,
      },
      masterVolume: 0.8,
      playing: true,
      positionSeconds: 1.5,
    },
    trackOrder: ['track-2', 'track-1'],
    tracksById: {
      'track-1': {
        id: 'track-1',
        muted: false,
        name: 'Track 1',
        pan: 0.25,
        regionOrder: ['region-1'],
        regionsById: {
          'region-1': {
            assetId: 'asset-1',
            duration: 2,
            id: 'region-1',
            offset: 0,
            startTime: 0,
          },
        },
        soloed: true,
        volume: 0.75,
      },
      'track-2': {
        id: 'track-2',
        muted: true,
        name: 'Track 2',
        pan: -0.25,
        regionOrder: ['region-2'],
        regionsById: {
          'region-2': {
            assetId: 'asset-2',
            duration: 1.5,
            id: 'region-2',
            offset: 0.5,
            startTime: 1,
          },
        },
        soloed: false,
        volume: 0.5,
      },
    },
  };
}

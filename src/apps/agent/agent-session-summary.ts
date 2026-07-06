export interface AgentRegionSummary {
  id: string;
  assetId: string;
  startTime: number;
  duration: number;
  offset: number;
}

export interface AgentTrackSummary {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  soloed: boolean;
  pan: number;
  regions: AgentRegionSummary[];
}

export interface AgentSessionSummary {
  sessionId: string;
  tracks: AgentTrackSummary[];
  playback: {
    playing: boolean;
    positionSeconds: number;
    bpm: number;
    masterVolume: number;
    loop: {
      start: number;
      end: number;
      enabled: boolean;
    };
  };
  exportRange: {
    startSeconds: number;
    endSeconds: number;
    fadeInSeconds: number;
    fadeOutSeconds: number;
  };
}

export interface AgentSessionSummarySource {
  id: string;
  trackOrder: string[];
  tracksById: Record<
    string,
    {
      id: string;
      name: string;
      volume: number;
      muted: boolean;
      soloed: boolean;
      pan: number;
      regionOrder: string[];
      regionsById: Record<string, AgentRegionSummary>;
    }
  >;
  playback: AgentSessionSummary['playback'];
  exportRange: AgentSessionSummary['exportRange'];
}

export function createAgentSessionSummary(
  session: AgentSessionSummarySource
): AgentSessionSummary {
  return {
    exportRange: { ...session.exportRange },
    playback: {
      bpm: session.playback.bpm,
      loop: { ...session.playback.loop },
      masterVolume: session.playback.masterVolume,
      playing: session.playback.playing,
      positionSeconds: session.playback.positionSeconds,
    },
    sessionId: session.id,
    tracks: session.trackOrder.map((trackId) => {
      const track = session.tracksById[trackId];

      return {
        id: track.id,
        muted: track.muted,
        name: track.name,
        pan: track.pan,
        regions: track.regionOrder.map((regionId) => {
          const region = track.regionsById[regionId];

          return {
            assetId: region.assetId,
            duration: region.duration,
            id: region.id,
            offset: region.offset,
            startTime: region.startTime,
          };
        }),
        soloed: track.soloed,
        volume: track.volume,
      };
    }),
  };
}

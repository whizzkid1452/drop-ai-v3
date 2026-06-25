import {
  Channel,
  Offline,
  Player,
  ToneAudioBuffer,
  getDestination,
  getTransport,
  start as startAudioContext,
} from 'tone';
import type { SessionState } from '@/session/session-state';
import type {
  AddAudioRegionInput,
  ExportSessionRangeInput,
  IAudioEngine,
  LoopRange,
  MoveAudioRegionInput,
  ResizeAudioRegionInput,
} from '../audio-engine';
import { applyOutputFade } from '../output-fade';
import { encodeWav } from '../wav-encoder';

interface TrackNode {
  channel: ReturnType<typeof Channel.prototype.toDestination>;
}

interface RegionNode {
  player: Player;
  trackId: string;
  startTime: number;
  duration: number;
  offset: number;
}

function unitToDb(volume: number): number {
  return volume <= 0 ? -Infinity : 20 * Math.log10(volume);
}

export class ToneAudioEngine implements IAudioEngine {
  private readonly tracks = new Map<string, TrackNode>();
  private readonly regions = new Map<string, RegionNode>();
  private readonly buffers = new Map<string, ToneAudioBuffer>();

  registerBuffer(assetId: string, buffer: ToneAudioBuffer): void {
    this.buffers.set(assetId, buffer);
  }

  async play(): Promise<void> {
    await startAudioContext();
    const transport = getTransport();
    if (transport.state !== 'started') {
      transport.start();
    }
  }

  pause(): void {
    getTransport().pause();
  }

  stop(): void {
    getTransport().stop();
  }

  seek(seconds: number): void {
    getTransport().seconds = seconds;
  }

  setBpm(bpm: number): void {
    getTransport().bpm.value = bpm;
  }

  setMasterVolume(volume: number): void {
    getDestination().volume.value = unitToDb(volume);
  }

  setLoop(loop: LoopRange): void {
    const transport = getTransport();
    transport.loopStart = loop.start;
    transport.loopEnd = loop.end;
    transport.loop = loop.enabled;
  }

  createTrack(trackId: string): void {
    if (this.tracks.has(trackId)) return;
    const channel = new Channel().toDestination();
    this.tracks.set(trackId, { channel });
  }

  removeTrack(trackId: string): void {
    const node = this.tracks.get(trackId);
    if (!node) return;
    for (const [regionId, region] of this.regions) {
      if (region.trackId === trackId) {
        region.player.dispose();
        this.regions.delete(regionId);
      }
    }
    node.channel.dispose();
    this.tracks.delete(trackId);
  }

  setTrackVolume(trackId: string, volume: number): void {
    const node = this.tracks.get(trackId);
    if (!node) return;
    node.channel.volume.value = unitToDb(volume);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const node = this.tracks.get(trackId);
    if (!node) return;
    node.channel.mute = muted;
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    const node = this.tracks.get(trackId);
    if (!node) return;
    node.channel.solo = soloed;
  }

  setTrackPan(trackId: string, pan: number): void {
    const node = this.tracks.get(trackId);
    if (!node) return;
    node.channel.pan.value = pan;
  }

  addRegion(input: AddAudioRegionInput): void {
    const trackNode = this.tracks.get(input.trackId);
    if (!trackNode) {
      throw new Error(`Track not found for region: ${input.trackId}`);
    }
    const buffer = this.buffers.get(input.assetId);
    if (!buffer) {
      throw new Error(`Asset buffer not registered: ${input.assetId}`);
    }

    const player = new Player(buffer).connect(trackNode.channel);
    player.sync().start(input.startTime, input.offset, input.duration);

    this.regions.set(input.regionId, {
      player,
      trackId: input.trackId,
      startTime: input.startTime,
      duration: input.duration,
      offset: input.offset,
    });
  }

  removeRegion(_trackId: string, regionId: string): void {
    const region = this.regions.get(regionId);
    if (!region) return;
    region.player.dispose();
    this.regions.delete(regionId);
  }

  moveRegion({ regionId, startTime }: MoveAudioRegionInput): void {
    const region = this.regions.get(regionId);
    if (!region) return;
    region.player.unsync();
    region.player.stop();
    region.player.sync().start(startTime, region.offset, region.duration);
    region.startTime = startTime;
  }

  resizeRegion({ regionId, duration }: ResizeAudioRegionInput): void {
    const region = this.regions.get(regionId);
    if (!region) return;
    region.player.unsync();
    region.player.stop();
    region.player.sync().start(region.startTime, region.offset, duration);
    region.duration = duration;
  }

  async getAssetDuration(assetId: string): Promise<number> {
    const buffer = this.buffers.get(assetId);
    if (!buffer) {
      throw new Error(`Asset not registered: ${assetId}`);
    }
    return buffer.duration;
  }

  async importFileAsset(
    assetId: string,
    file: File
  ): Promise<{ duration: number }> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const buffer = new ToneAudioBuffer();
      await buffer.load(objectUrl);
      this.registerBuffer(assetId, buffer);
      return { duration: buffer.duration };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async exportSession(
    durationSeconds: number,
    session: SessionState
  ): Promise<Blob> {
    const offlineBuffer = await this.renderOfflineSession({
      durationSeconds,
      session,
    });

    const audioBuffer = offlineBuffer.get();
    if (!audioBuffer) {
      throw new Error('Failed to render offline buffer.');
    }
    return encodeWav(audioBuffer);
  }

  async exportSessionRange(input: ExportSessionRangeInput): Promise<Blob> {
    const offlineBuffer = await this.renderOfflineSession(input);
    const audioBuffer = offlineBuffer.get();
    if (!audioBuffer) {
      throw new Error('Failed to render offline buffer.');
    }

    applyOutputFade(audioBuffer, {
      fadeInSeconds: input.fadeInSeconds,
      fadeOutSeconds: input.fadeOutSeconds,
    });

    return encodeWav(audioBuffer);
  }

  private async renderOfflineSession(input: {
    durationSeconds: number;
    endSeconds?: number;
    session: SessionState;
    startSeconds?: number;
  }) {
    const buffers = this.buffers;
    const exportStart = input.startSeconds;
    const exportEnd = input.endSeconds;

    return await Offline(({ transport }) => {
      transport.bpm.value = input.session.playback.bpm;
      getDestination().volume.value = unitToDb(
        input.session.playback.masterVolume
      );

      for (const trackId of input.session.trackOrder) {
        const track = input.session.tracksById[trackId];
        const channel = createOfflineChannel(track);

        for (const regionId of track.regionOrder) {
          const region = track.regionsById[regionId];
          const buffer = buffers.get(region.assetId);
          if (!buffer) {
            throw new Error(
              `Asset buffer not registered for export: ${region.assetId}`
            );
          }

          const schedule = getOfflineRegionSchedule({
            exportEnd,
            exportStart,
            region,
          });

          if (!schedule) {
            continue;
          }

          const player = new Player(buffer).connect(channel);
          player
            .sync()
            .start(schedule.startTime, schedule.offset, schedule.duration);
        }
      }

      transport.start();
    }, input.durationSeconds);
  }
}

function createOfflineChannel(track: SessionState['tracksById'][string]) {
  const channel = new Channel().toDestination();
  channel.volume.value = unitToDb(track.volume);
  channel.mute = track.muted;
  channel.solo = track.soloed;
  channel.pan.value = track.pan;
  return channel;
}

function getOfflineRegionSchedule(input: {
  exportEnd: number | undefined;
  exportStart: number | undefined;
  region: SessionState['tracksById'][string]['regionsById'][string];
}): { duration: number; offset: number; startTime: number } | undefined {
  const { exportEnd, exportStart, region } = input;

  if (exportStart === undefined || exportEnd === undefined) {
    return {
      duration: region.duration,
      offset: region.offset,
      startTime: region.startTime,
    };
  }

  const regionEnd = region.startTime + region.duration;
  const intersectionStart = Math.max(region.startTime, exportStart);
  const intersectionEnd = Math.min(regionEnd, exportEnd);
  const duration = intersectionEnd - intersectionStart;

  if (duration <= 0) {
    return undefined;
  }

  return {
    duration,
    offset: region.offset + (intersectionStart - region.startTime),
    startTime: intersectionStart - exportStart,
  };
}

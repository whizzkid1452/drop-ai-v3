import * as Tone from 'tone';
import type { SessionState } from '@/layers/core/session/session-state';
import type {
  AddAudioRegionInput,
  AudioProvider,
  LoopRange,
} from '../audio-provider';

interface RegisteredBuffer {
  duration: number;
}

interface TrackNode {
  channel: ReturnType<typeof Tone.Channel.prototype.toDestination>;
}

interface RegionNode {
  player: Tone.Player;
  trackId: string;
  startTime: number;
  duration: number;
  offset: number;
}

function unitToDb(volume: number): number {
  return volume <= 0 ? -Infinity : 20 * Math.log10(volume);
}

export class ToneAudioProvider implements AudioProvider {
  private readonly tracks = new Map<string, TrackNode>();
  private readonly regions = new Map<string, RegionNode>();
  private readonly buffers = new Map<string, RegisteredBuffer>();

  registerBuffer(assetId: string, buffer: RegisteredBuffer): void {
    this.buffers.set(assetId, buffer);
  }

  async play(): Promise<void> {
    const transport = Tone.getTransport();
    if (transport.state !== 'started') {
      transport.start();
    }
  }

  pause(): void {
    Tone.getTransport().pause();
  }

  stop(): void {
    Tone.getTransport().stop();
  }

  seek(seconds: number): void {
    Tone.getTransport().seconds = seconds;
  }

  setBpm(bpm: number): void {
    Tone.getTransport().bpm.value = bpm;
  }

  setMasterVolume(volume: number): void {
    Tone.getDestination().volume.value = unitToDb(volume);
  }

  setLoop(loop: LoopRange): void {
    const transport = Tone.getTransport();
    transport.loopStart = loop.start;
    transport.loopEnd = loop.end;
    transport.loop = loop.enabled;
  }

  createTrack(trackId: string): void {
    if (this.tracks.has(trackId)) return;
    const channel = new Tone.Channel().toDestination();
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

    const player = new Tone.Player(buffer as Tone.ToneAudioBuffer).connect(
      trackNode.channel
    );
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

  moveRegion(_trackId: string, regionId: string, startTime: number): void {
    const region = this.regions.get(regionId);
    if (!region) return;
    region.player.unsync();
    region.player.stop();
    region.player.sync().start(startTime, region.offset, region.duration);
    region.startTime = startTime;
  }

  resizeRegion(_trackId: string, regionId: string, duration: number): void {
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

  async exportSession(
    _durationSeconds: number,
    _session: SessionState
  ): Promise<Blob> {
    throw new Error('ToneAudioProvider.exportSession not implemented yet.');
  }

  async syncSession(session: SessionState): Promise<void> {
    this.disposeAll();

    for (const trackId of session.trackOrder) {
      const track = session.tracksById[trackId];
      this.createTrack(trackId);
      this.setTrackVolume(trackId, track.volume);
      this.setTrackMute(trackId, track.muted);
      this.setTrackSolo(trackId, track.soloed);
      this.setTrackPan(trackId, track.pan);

      for (const regionId of track.regionOrder) {
        const region = track.regionsById[regionId];
        this.addRegion({
          trackId,
          regionId,
          assetId: region.assetId,
          startTime: region.startTime,
          duration: region.duration,
          offset: region.offset,
        });
      }
    }
  }

  private disposeAll(): void {
    for (const region of this.regions.values()) {
      region.player.dispose();
    }
    this.regions.clear();
    for (const track of this.tracks.values()) {
      track.channel.dispose();
    }
    this.tracks.clear();
  }
}

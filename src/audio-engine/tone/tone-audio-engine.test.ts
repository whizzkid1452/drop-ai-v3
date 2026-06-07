import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToneAudioBuffer } from 'tone';

function fakeToneBuffer(duration: number): ToneAudioBuffer {
  return { duration } as unknown as ToneAudioBuffer;
}

interface ChannelMock {
  toDestination: ReturnType<typeof vi.fn>;
  volume: { value: number };
  mute: boolean;
  solo: boolean;
  pan: { value: number };
  dispose: ReturnType<typeof vi.fn>;
}

interface PlayerMock {
  bufferRef: { duration: number } | undefined;
  connect: ReturnType<typeof vi.fn>;
  sync: ReturnType<typeof vi.fn>;
  unsync: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

interface ToneAudioBufferMock {
  duration: number;
  load: ReturnType<typeof vi.fn>;
  loadedUrl: string | undefined;
}

interface OfflineTransportMock {
  bpm: { value: number };
  start: ReturnType<typeof vi.fn>;
}

interface OfflineRunRecord {
  duration: number;
  transport: OfflineTransportMock;
  channelInstancesAtStart: number;
  playerInstancesAtStart: number;
  channelInstancesAfter: ChannelMock[];
  playerInstancesAfter: PlayerMock[];
}

interface ToneState {
  transport: {
    start: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    seconds: number;
    bpm: { value: number };
    loopStart: number;
    loopEnd: number;
    loop: boolean;
    state: string;
  };
  destination: { volume: { value: number } };
  channelInstances: ChannelMock[];
  playerInstances: PlayerMock[];
  toneAudioBufferInstances: ToneAudioBufferMock[];
  offlineCalls: OfflineRunRecord[];
  offlineSampleRate: number;
  nextBufferDuration: number;
}

const toneState: ToneState = {
  transport: {
    start: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seconds: 0,
    bpm: { value: 120 },
    loopStart: 0,
    loopEnd: 0,
    loop: false,
    state: 'stopped',
  },
  destination: { volume: { value: 0 } },
  channelInstances: [],
  playerInstances: [],
  toneAudioBufferInstances: [],
  offlineCalls: [],
  offlineSampleRate: 44100,
  nextBufferDuration: 1,
};

function makeChannel(): ChannelMock {
  const channel: ChannelMock = {
    toDestination: vi.fn(),
    volume: { value: 0 },
    mute: false,
    solo: false,
    pan: { value: 0 },
    dispose: vi.fn(),
  };
  channel.toDestination.mockReturnValue(channel);
  toneState.channelInstances.push(channel);
  return channel;
}

function makePlayer(buffer: { duration: number } | undefined): PlayerMock {
  const player: PlayerMock = {
    bufferRef: buffer,
    connect: vi.fn(),
    sync: vi.fn(),
    unsync: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
  player.connect.mockReturnValue(player);
  player.sync.mockReturnValue(player);
  player.unsync.mockReturnValue(player);
  toneState.playerInstances.push(player);
  return player;
}

class MockChannelCtor {
  constructor() {
    return makeChannel();
  }
}

class MockPlayerCtor {
  constructor(buffer: { duration: number } | undefined) {
    return makePlayer(buffer);
  }
}

class MockToneAudioBufferCtor {
  duration = toneState.nextBufferDuration;
  loadedUrl: string | undefined;
  load = vi.fn(async (url: string) => {
    this.loadedUrl = url;
    return this;
  });

  constructor() {
    toneState.toneAudioBufferInstances.push(this);
  }
}

async function offlineMock(
  callback: (ctx: { transport: OfflineTransportMock }) => unknown,
  duration: number
) {
  const transport: OfflineTransportMock = {
    bpm: { value: 0 },
    start: vi.fn(),
  };
  const channelInstancesAtStart = toneState.channelInstances.length;
  const playerInstancesAtStart = toneState.playerInstances.length;
  await callback({ transport });
  const sampleCount = Math.max(
    1,
    Math.floor(duration * toneState.offlineSampleRate)
  );
  const buffer = createMockAudioBuffer(
    2,
    sampleCount,
    toneState.offlineSampleRate
  );
  toneState.offlineCalls.push({
    duration,
    transport,
    channelInstancesAtStart,
    playerInstancesAtStart,
    channelInstancesAfter: toneState.channelInstances.slice(
      channelInstancesAtStart
    ),
    playerInstancesAfter: toneState.playerInstances.slice(
      playerInstancesAtStart
    ),
  });
  return { get: () => buffer };
}

function createMockAudioBuffer(
  channels: number,
  samples: number,
  sampleRate: number
): AudioBuffer {
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c += 1) {
    data.push(new Float32Array(samples));
  }
  return {
    numberOfChannels: channels,
    sampleRate,
    length: samples,
    getChannelData: (ch: number) => data[ch],
  } as unknown as AudioBuffer;
}

vi.mock('tone', () => ({
  getTransport: () => toneState.transport,
  getDestination: () => toneState.destination,
  Channel: MockChannelCtor,
  Player: MockPlayerCtor,
  ToneAudioBuffer: MockToneAudioBufferCtor,
  Offline: offlineMock,
}));

beforeEach(() => {
  toneState.transport.start.mockClear();
  toneState.transport.pause.mockClear();
  toneState.transport.stop.mockClear();
  toneState.transport.seconds = 0;
  toneState.transport.bpm.value = 120;
  toneState.transport.loopStart = 0;
  toneState.transport.loopEnd = 0;
  toneState.transport.loop = false;
  toneState.transport.state = 'stopped';
  toneState.destination.volume.value = 0;
  toneState.channelInstances.length = 0;
  toneState.playerInstances.length = 0;
  toneState.toneAudioBufferInstances.length = 0;
  toneState.offlineCalls.length = 0;
  toneState.nextBufferDuration = 1;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ToneAudioEngine transport', () => {
  it('play starts Tone Transport when not already started', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    await provider.play();

    expect(toneState.transport.start).toHaveBeenCalledTimes(1);
  });

  it('play is a no-op when Tone Transport is already started', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    toneState.transport.state = 'started';

    await provider.play();

    expect(toneState.transport.start).not.toHaveBeenCalled();
  });

  it('pause calls Tone Transport pause', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    provider.pause();

    expect(toneState.transport.pause).toHaveBeenCalledTimes(1);
  });

  it('stop calls Tone Transport stop', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    provider.stop();

    expect(toneState.transport.stop).toHaveBeenCalledTimes(1);
  });

  it('seek sets Tone Transport seconds', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    provider.seek(3.5);

    expect(toneState.transport.seconds).toBe(3.5);
  });

  it('setBpm sets Tone Transport bpm value', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    provider.setBpm(140);

    expect(toneState.transport.bpm.value).toBe(140);
  });

  it('setMasterVolume converts unit value to dB on the destination', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    provider.setMasterVolume(1);
    expect(toneState.destination.volume.value).toBe(0);

    provider.setMasterVolume(0);
    expect(toneState.destination.volume.value).toBe(-Infinity);

    provider.setMasterVolume(0.5);
    expect(toneState.destination.volume.value).toBeCloseTo(-6.0206, 3);
  });

  it('setLoop wires loopStart, loopEnd, and loop flag', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    provider.setLoop({ start: 1, end: 5, enabled: true });

    expect(toneState.transport.loopStart).toBe(1);
    expect(toneState.transport.loopEnd).toBe(5);
    expect(toneState.transport.loop).toBe(true);
  });

  it('setLoop with enabled false disables the loop flag', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    provider.setLoop({ start: 1, end: 5, enabled: false });

    expect(toneState.transport.loop).toBe(false);
  });
});

describe('ToneAudioEngine track wiring', () => {
  it('createTrack registers a Tone.Channel connected to destination', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    provider.createTrack('track-1');

    expect(toneState.channelInstances).toHaveLength(1);
    expect(toneState.channelInstances[0].toDestination).toHaveBeenCalledTimes(
      1
    );
  });

  it('createTrack is idempotent for the same trackId', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    provider.createTrack('track-1');
    provider.createTrack('track-1');

    expect(toneState.channelInstances).toHaveLength(1);
  });

  it('setTrackVolume converts unit value to dB on the channel', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    provider.createTrack('track-1');

    provider.setTrackVolume('track-1', 0.5);

    expect(toneState.channelInstances[0].volume.value).toBeCloseTo(-6.0206, 3);
  });

  it('setTrackMute, setTrackSolo, and setTrackPan update the channel', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    provider.createTrack('track-1');
    const channel = toneState.channelInstances[0];

    provider.setTrackMute('track-1', true);
    provider.setTrackSolo('track-1', true);
    provider.setTrackPan('track-1', -0.4);

    expect(channel.mute).toBe(true);
    expect(channel.solo).toBe(true);
    expect(channel.pan.value).toBe(-0.4);
  });

  it('removeTrack disposes the channel', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    provider.createTrack('track-1');
    const channel = toneState.channelInstances[0];

    provider.removeTrack('track-1');

    expect(channel.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('ToneAudioEngine region wiring', () => {
  const ASSET_ID = 'asset-1';
  const REGION_INPUT = {
    trackId: 'track-1',
    regionId: 'region-1',
    assetId: ASSET_ID,
    startTime: 2,
    duration: 3,
    offset: 0.5,
  };

  it('getAssetDuration returns the duration of a registered buffer', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    provider.registerBuffer(ASSET_ID, fakeToneBuffer(4.2));

    const duration = await provider.getAssetDuration(ASSET_ID);

    expect(duration).toBe(4.2);
  });

  it('getAssetDuration throws for an unregistered asset', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    await expect(provider.getAssetDuration('missing')).rejects.toThrow(
      /asset/i
    );
  });

  it('imports a File into a ToneAudioBuffer and registers it by assetId', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const createObjectURL = vi.fn(() => 'blob:asset-1');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    toneState.nextBufferDuration = 3.75;
    const provider = new ToneAudioEngine();
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });

    const result = await provider.importFileAsset('asset-file-1', file);

    expect(result).toEqual({ duration: 3.75 });
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(toneState.toneAudioBufferInstances).toHaveLength(1);
    expect(toneState.toneAudioBufferInstances[0].load).toHaveBeenCalledWith(
      'blob:asset-1'
    );
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:asset-1');
    await expect(provider.getAssetDuration('asset-file-1')).resolves.toBe(3.75);
  });

  it('addRegion creates a Player, connects it to the track channel, and syncs at startTime/offset/duration', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    provider.registerBuffer(ASSET_ID, fakeToneBuffer(4));
    provider.createTrack('track-1');
    const channel = toneState.channelInstances[0];

    provider.addRegion(REGION_INPUT);

    expect(toneState.playerInstances).toHaveLength(1);
    const player = toneState.playerInstances[0];
    expect(player.bufferRef).toEqual({ duration: 4 });
    expect(player.connect).toHaveBeenCalledWith(channel);
    expect(player.sync).toHaveBeenCalledTimes(1);
    expect(player.start).toHaveBeenCalledWith(2, 0.5, 3);
  });

  it('addRegion throws when the track does not exist', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    provider.registerBuffer(ASSET_ID, fakeToneBuffer(4));

    expect(() => provider.addRegion(REGION_INPUT)).toThrow(/track/i);
  });

  it('moveRegion unsyncs, stops, and restarts at new startTime preserving offset and duration', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    provider.registerBuffer(ASSET_ID, fakeToneBuffer(4));
    provider.createTrack('track-1');
    provider.addRegion(REGION_INPUT);
    const player = toneState.playerInstances[0];
    player.start.mockClear();

    provider.moveRegion({
      trackId: 'track-1',
      regionId: 'region-1',
      startTime: 7,
    });

    expect(player.unsync).toHaveBeenCalled();
    expect(player.stop).toHaveBeenCalled();
    expect(player.sync).toHaveBeenCalledTimes(2);
    expect(player.start).toHaveBeenCalledWith(7, 0.5, 3);
  });

  it('resizeRegion restarts the player with the new duration', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    provider.registerBuffer(ASSET_ID, fakeToneBuffer(4));
    provider.createTrack('track-1');
    provider.addRegion(REGION_INPUT);
    const player = toneState.playerInstances[0];
    player.start.mockClear();

    provider.resizeRegion({
      trackId: 'track-1',
      regionId: 'region-1',
      duration: 1.5,
    });

    expect(player.start).toHaveBeenCalledWith(2, 0.5, 1.5);
  });

  it('removeRegion disposes the player', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    provider.registerBuffer(ASSET_ID, fakeToneBuffer(4));
    provider.createTrack('track-1');
    provider.addRegion(REGION_INPUT);
    const player = toneState.playerInstances[0];

    provider.removeRegion('track-1', 'region-1');

    expect(player.dispose).toHaveBeenCalledTimes(1);
  });

  it('removeTrack also disposes attached region players', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    provider.registerBuffer(ASSET_ID, fakeToneBuffer(4));
    provider.createTrack('track-1');
    provider.addRegion(REGION_INPUT);
    const channel = toneState.channelInstances[0];
    const player = toneState.playerInstances[0];

    provider.removeTrack('track-1');

    expect(channel.dispose).toHaveBeenCalledTimes(1);
    expect(player.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('ToneAudioEngine.exportSession', () => {
  async function makeProviderWithBuffers() {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();
    provider.registerBuffer('asset-1', fakeToneBuffer(4));
    return provider;
  }

  function snapshotForExport() {
    return {
      id: 'session-1',
      trackOrder: ['track-1'],
      tracksById: {
        'track-1': {
          id: 'track-1',
          name: 'A',
          volume: 0.5,
          muted: false,
          soloed: false,
          pan: 0.2,
          regionOrder: ['region-1'],
          regionsById: {
            'region-1': {
              id: 'region-1',
              assetId: 'asset-1',
              startTime: 0,
              duration: 2,
              offset: 0,
            },
          },
        },
      },
      playback: {
        playing: false,
        positionSeconds: 0,
        bpm: 130,
        masterVolume: 1,
        loop: { start: 0, end: 4, enabled: false },
      },
    };
  }

  it('returns a Blob with audio/wav mime type', async () => {
    const provider = await makeProviderWithBuffers();

    const blob = await provider.exportSession(2, snapshotForExport());

    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBeGreaterThan(44);
  });

  it('calls Tone.Offline with the requested duration', async () => {
    const provider = await makeProviderWithBuffers();

    await provider.exportSession(2.5, snapshotForExport());

    expect(toneState.offlineCalls).toHaveLength(1);
    expect(toneState.offlineCalls[0].duration).toBe(2.5);
  });

  it('copies session playback bpm to the offline transport', async () => {
    const provider = await makeProviderWithBuffers();
    toneState.transport.bpm.value = 96;

    await provider.exportSession(1, snapshotForExport());

    expect(toneState.offlineCalls[0].transport.bpm.value).toBe(130);
  });

  it('applies session master volume to the offline destination', async () => {
    const provider = await makeProviderWithBuffers();
    const snapshot = snapshotForExport();
    snapshot.playback.masterVolume = 0.5;

    await provider.exportSession(1, snapshot);

    expect(toneState.destination.volume.value).toBeCloseTo(-6.0206, 3);
  });

  it('rebuilds tracks and regions inside the offline context', async () => {
    const provider = await makeProviderWithBuffers();

    await provider.exportSession(2, snapshotForExport());

    const run = toneState.offlineCalls[0];
    expect(run.channelInstancesAfter).toHaveLength(1);
    expect(run.playerInstancesAfter).toHaveLength(1);
    expect(run.playerInstancesAfter[0].start).toHaveBeenCalledWith(0, 0, 2);
  });

  it('starts the offline transport', async () => {
    const provider = await makeProviderWithBuffers();

    await provider.exportSession(1, snapshotForExport());

    expect(toneState.offlineCalls[0].transport.start).toHaveBeenCalledTimes(1);
  });

  it('throws when a region asset is not registered', async () => {
    const { ToneAudioEngine } = await import('./tone-audio-engine');
    const provider = new ToneAudioEngine();

    await expect(
      provider.exportSession(1, snapshotForExport())
    ).rejects.toThrow(/asset/i);
  });
});

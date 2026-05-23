import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const toneState = {
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
  channelInstances: [] as ChannelMock[],
  playerInstances: [] as PlayerMock[],
  offlineCalls: [] as OfflineRunRecord[],
  offlineSampleRate: 44100,
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
  const sampleCount = Math.max(1, Math.floor(duration * toneState.offlineSampleRate));
  const buffer = createMockAudioBuffer(2, sampleCount, toneState.offlineSampleRate);
  toneState.offlineCalls.push({
    duration,
    transport,
    channelInstancesAtStart,
    playerInstancesAtStart,
    channelInstancesAfter: toneState.channelInstances.slice(channelInstancesAtStart),
    playerInstancesAfter: toneState.playerInstances.slice(playerInstancesAtStart),
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
  ToneAudioBuffer: class {},
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
  toneState.offlineCalls.length = 0;
});

describe('ToneAudioProvider transport', () => {
  it('play starts Tone Transport when not already started', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    await provider.play();

    expect(toneState.transport.start).toHaveBeenCalledTimes(1);
  });

  it('play is a no-op when Tone Transport is already started', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    toneState.transport.state = 'started';

    await provider.play();

    expect(toneState.transport.start).not.toHaveBeenCalled();
  });

  it('pause calls Tone Transport pause', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    provider.pause();

    expect(toneState.transport.pause).toHaveBeenCalledTimes(1);
  });

  it('stop calls Tone Transport stop', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    provider.stop();

    expect(toneState.transport.stop).toHaveBeenCalledTimes(1);
  });

  it('seek sets Tone Transport seconds', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    provider.seek(3.5);

    expect(toneState.transport.seconds).toBe(3.5);
  });

  it('setBpm sets Tone Transport bpm value', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    provider.setBpm(140);

    expect(toneState.transport.bpm.value).toBe(140);
  });

  it('setMasterVolume converts unit value to dB on the destination', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    provider.setMasterVolume(1);
    expect(toneState.destination.volume.value).toBe(0);

    provider.setMasterVolume(0);
    expect(toneState.destination.volume.value).toBe(-Infinity);

    provider.setMasterVolume(0.5);
    expect(toneState.destination.volume.value).toBeCloseTo(-6.0206, 3);
  });

  it('setLoop wires loopStart, loopEnd, and loop flag', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    provider.setLoop({ start: 1, end: 5, enabled: true });

    expect(toneState.transport.loopStart).toBe(1);
    expect(toneState.transport.loopEnd).toBe(5);
    expect(toneState.transport.loop).toBe(true);
  });

  it('setLoop with enabled false disables the loop flag', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    provider.setLoop({ start: 1, end: 5, enabled: false });

    expect(toneState.transport.loop).toBe(false);
  });
});

describe('ToneAudioProvider track wiring', () => {
  it('createTrack registers a Tone.Channel connected to destination', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    provider.createTrack('track-1');

    expect(toneState.channelInstances).toHaveLength(1);
    expect(toneState.channelInstances[0].toDestination).toHaveBeenCalledTimes(1);
  });

  it('createTrack is idempotent for the same trackId', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    provider.createTrack('track-1');
    provider.createTrack('track-1');

    expect(toneState.channelInstances).toHaveLength(1);
  });

  it('setTrackVolume converts unit value to dB on the channel', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    provider.createTrack('track-1');

    provider.setTrackVolume('track-1', 0.5);

    expect(toneState.channelInstances[0].volume.value).toBeCloseTo(-6.0206, 3);
  });

  it('setTrackMute, setTrackSolo, and setTrackPan update the channel', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
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
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    provider.createTrack('track-1');
    const channel = toneState.channelInstances[0];

    provider.removeTrack('track-1');

    expect(channel.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('ToneAudioProvider region wiring', () => {
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
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    provider.registerBuffer(ASSET_ID, { duration: 4.2 });

    const duration = await provider.getAssetDuration(ASSET_ID);

    expect(duration).toBe(4.2);
  });

  it('getAssetDuration throws for an unregistered asset', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    await expect(provider.getAssetDuration('missing')).rejects.toThrow(
      /asset/i
    );
  });

  it('addRegion creates a Player, connects it to the track channel, and syncs at startTime/offset/duration', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    provider.registerBuffer(ASSET_ID, { duration: 4 });
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
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    provider.registerBuffer(ASSET_ID, { duration: 4 });

    expect(() => provider.addRegion(REGION_INPUT)).toThrow(/track/i);
  });

  it('moveRegion unsyncs, stops, and restarts at new startTime preserving offset and duration', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    provider.registerBuffer(ASSET_ID, { duration: 4 });
    provider.createTrack('track-1');
    provider.addRegion(REGION_INPUT);
    const player = toneState.playerInstances[0];
    player.start.mockClear();

    provider.moveRegion('track-1', 'region-1', 7);

    expect(player.unsync).toHaveBeenCalled();
    expect(player.stop).toHaveBeenCalled();
    expect(player.sync).toHaveBeenCalledTimes(2);
    expect(player.start).toHaveBeenCalledWith(7, 0.5, 3);
  });

  it('resizeRegion restarts the player with the new duration', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    provider.registerBuffer(ASSET_ID, { duration: 4 });
    provider.createTrack('track-1');
    provider.addRegion(REGION_INPUT);
    const player = toneState.playerInstances[0];
    player.start.mockClear();

    provider.resizeRegion('track-1', 'region-1', 1.5);

    expect(player.start).toHaveBeenCalledWith(2, 0.5, 1.5);
  });

  it('removeRegion disposes the player', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    provider.registerBuffer(ASSET_ID, { duration: 4 });
    provider.createTrack('track-1');
    provider.addRegion(REGION_INPUT);
    const player = toneState.playerInstances[0];

    provider.removeRegion('track-1', 'region-1');

    expect(player.dispose).toHaveBeenCalledTimes(1);
  });

  it('removeTrack also disposes attached region players', async () => {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    provider.registerBuffer(ASSET_ID, { duration: 4 });
    provider.createTrack('track-1');
    provider.addRegion(REGION_INPUT);
    const channel = toneState.channelInstances[0];
    const player = toneState.playerInstances[0];

    provider.removeTrack('track-1');

    expect(channel.dispose).toHaveBeenCalledTimes(1);
    expect(player.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('ToneAudioProvider.syncSession', () => {
  async function setupWithBuffers() {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    provider.registerBuffer('asset-1', { duration: 4 });
    provider.registerBuffer('asset-2', { duration: 3 });
    return provider;
  }

  function makeSnapshot() {
    return {
      id: 'session-1',
      trackOrder: ['track-1', 'track-2'],
      tracksById: {
        'track-1': {
          id: 'track-1',
          name: 'A',
          volume: 0.5,
          muted: false,
          soloed: false,
          pan: -0.2,
          regionOrder: ['region-1'],
          regionsById: {
            'region-1': {
              id: 'region-1',
              assetId: 'asset-1',
              startTime: 0,
              duration: 4,
              offset: 0,
            },
          },
        },
        'track-2': {
          id: 'track-2',
          name: 'B',
          volume: 1,
          muted: true,
          soloed: false,
          pan: 0,
          regionOrder: ['region-2'],
          regionsById: {
            'region-2': {
              id: 'region-2',
              assetId: 'asset-2',
              startTime: 2,
              duration: 3,
              offset: 0.5,
            },
          },
        },
      },
      playback: {
        playing: false,
        positionSeconds: 0,
        bpm: 120,
        masterVolume: 1,
        loop: { start: 0, end: 4, enabled: false },
      },
      dirty: false,
      updatedAt: '2026-05-23T00:00:00.000Z',
    };
  }

  it('recreates channels and players from a snapshot', async () => {
    const provider = await setupWithBuffers();

    await provider.syncSession(makeSnapshot());

    expect(toneState.channelInstances).toHaveLength(2);
    expect(toneState.playerInstances).toHaveLength(2);
    expect(toneState.playerInstances[0].start).toHaveBeenCalledWith(0, 0, 4);
    expect(toneState.playerInstances[1].start).toHaveBeenCalledWith(2, 0.5, 3);
  });

  it('applies mixer values (volume, mute, pan) on synced channels', async () => {
    const provider = await setupWithBuffers();

    await provider.syncSession(makeSnapshot());

    expect(toneState.channelInstances[0].volume.value).toBeCloseTo(-6.0206, 3);
    expect(toneState.channelInstances[0].pan.value).toBe(-0.2);
    expect(toneState.channelInstances[1].mute).toBe(true);
  });

  it('disposes previous channels and players before rebuilding', async () => {
    const provider = await setupWithBuffers();
    await provider.syncSession(makeSnapshot());
    const firstChannels = [...toneState.channelInstances];
    const firstPlayers = [...toneState.playerInstances];

    await provider.syncSession(makeSnapshot());

    for (const channel of firstChannels) {
      expect(channel.dispose).toHaveBeenCalled();
    }
    for (const player of firstPlayers) {
      expect(player.dispose).toHaveBeenCalled();
    }
  });

  it('is idempotent in resulting state when called with the same snapshot', async () => {
    const provider = await setupWithBuffers();

    await provider.syncSession(makeSnapshot());
    const channelCountAfterFirst = toneState.channelInstances.length;
    const playerCountAfterFirst = toneState.playerInstances.length;

    await provider.syncSession(makeSnapshot());
    const newChannelCount =
      toneState.channelInstances.length - channelCountAfterFirst;
    const newPlayerCount =
      toneState.playerInstances.length - playerCountAfterFirst;

    expect(newChannelCount).toBe(2);
    expect(newPlayerCount).toBe(2);
  });

  it('with an empty session disposes all existing state', async () => {
    const provider = await setupWithBuffers();
    await provider.syncSession(makeSnapshot());
    const firstChannels = [...toneState.channelInstances];

    await provider.syncSession({
      ...makeSnapshot(),
      trackOrder: [],
      tracksById: {},
    });

    for (const channel of firstChannels) {
      expect(channel.dispose).toHaveBeenCalled();
    }
  });
});

describe('ToneAudioProvider.exportSession', () => {
  async function makeProviderWithBuffers() {
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();
    provider.registerBuffer('asset-1', { duration: 4 });
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
      dirty: false,
      updatedAt: '2026-05-23T00:00:00.000Z',
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

  it('copies current transport bpm to the offline transport', async () => {
    const provider = await makeProviderWithBuffers();
    toneState.transport.bpm.value = 96;

    await provider.exportSession(1, snapshotForExport());

    expect(toneState.offlineCalls[0].transport.bpm.value).toBe(96);
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
    const { ToneAudioProvider } = await import('./tone-audio-provider');
    const provider = new ToneAudioProvider();

    await expect(
      provider.exportSession(1, snapshotForExport())
    ).rejects.toThrow(/asset/i);
  });
});

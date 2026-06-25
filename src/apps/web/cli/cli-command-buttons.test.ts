import { describe, expect, it } from 'vitest';
import { runCli } from '@/apps/cli/cli-runner';
import { cliCommandRegistry } from '@/apps/cli/command-registry';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createApp } from '@/composition/create-app';
import { uploadFileToSession } from '../upload/upload-session-flow';
import {
  createCliCommandButtons,
  groupCliCommandButtons,
} from './cli-command-buttons';

const LOCAL_COMMAND_COUNT = 4;

describe('createCliCommandButtons', () => {
  it('creates one button command for every local and registered CLI command', () => {
    const uploadInfo = createUploadInfo();

    const buttons = createCliCommandButtons(uploadInfo);

    expect(buttons).toHaveLength(
      LOCAL_COMMAND_COUNT + cliCommandRegistry.length
    );
    expect(buttons.map((button) => button.usage)).toEqual([
      'help',
      'commands',
      'status',
      'asset upload',
      ...cliCommandRegistry.map((definition) => definition.usage),
    ]);
  });

  it('maps uploaded ids into commands that require session entity ids', () => {
    const uploadInfo = createUploadInfo();

    const buttons = createCliCommandButtons(uploadInfo);

    expect(commandInputFor(buttons, 'volume <trackId> <0..1>')).toBe(
      'volume track-uploaded 0.8'
    );
    expect(
      commandInputFor(buttons, 'region add <trackId> <assetId> [startTime]')
    ).toBe('region add track-uploaded asset-uploaded 0');
    expect(
      commandInputFor(buttons, 'region split <trackId> <regionId> <splitTime>')
    ).toBe('region split track-uploaded region-uploaded 2');
  });

  it('groups button commands in CLI command-list order', () => {
    const groups = groupCliCommandButtons(
      createCliCommandButtons(createUploadInfo())
    );

    expect(groups.map((group) => group.group)).toEqual([
      'Local',
      'Playback',
      'Track',
      'Region',
      'Session',
    ]);
  });

  it('builds command inputs that run through the CLI runner', async () => {
    const buttonUsages = createCliCommandButtons(createUploadInfo()).map(
      (button) => button.usage
    );

    for (const usage of buttonUsages) {
      const { app, uploadInfo } = await setupUploadedApp();
      const button = createCliCommandButtons(uploadInfo).find(
        (candidate) => candidate.usage === usage
      );

      if (!button) {
        throw new Error(`Could not find command button for usage: ${usage}`);
      }

      const result = await runCli(button.commandInput, {
        appController: app.controller,
        getStatusText: () => 'Session: session-1',
        requestUploadFile: async () => ({
          ok: true,
          file: new File(['audio'], 'button.wav', { type: 'audio/wav' }),
        }),
        uploadInfo,
      });

      expect(result.ok, button.commandInput).toBe(true);
    }
  });
});

function commandInputFor(
  buttons: ReturnType<typeof createCliCommandButtons>,
  usage: string
): string {
  const button = buttons.find((candidate) => candidate.usage === usage);

  if (!button) {
    throw new Error(`Could not find command button for usage: ${usage}`);
  }

  return button.commandInput;
}

function createUploadInfo() {
  return {
    assetId: 'asset-uploaded',
    duration: 4,
    filename: 'loop.wav',
    regionId: 'region-uploaded',
    trackId: 'track-uploaded',
  };
}

async function setupUploadedApp() {
  const app = createApp({
    audioEngine: new FakeAudioEngine({
      assetDurations: { 'asset-1': 4 },
    }),
    idGenerator: createPerPrefixIdGenerator(),
    sessionId: 'session-1',
  });
  const uploadResult = await uploadFileToSession(
    new File(['audio'], 'loop.wav', { type: 'audio/wav' }),
    app.controller
  );

  if (!uploadResult.ok) {
    throw new Error(uploadResult.message);
  }

  return { app, uploadInfo: uploadResult.uploadInfo };
}

function createPerPrefixIdGenerator() {
  const counters: Record<string, number> = {};

  return {
    next(prefix = 'id') {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
  };
}

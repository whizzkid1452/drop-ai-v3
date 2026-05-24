import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { createApp } from '../src/layers/composition/create-app';
import { runCli } from '../src/layers/apps/cli/cli-runner';
import type { IdGenerator } from '../src/layers/controllers/id-generator';

function createCounterIdGenerator(): IdGenerator {
  const counters: Record<string, number> = {};
  return {
    next(prefix = 'id') {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
  };
}

function isExportData(
  data: unknown
): data is { blob: Blob; filename: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'blob' in data &&
    'filename' in data
  );
}

const HELP_TEXT = `
Available commands:
  Transport:
    play | pause | stop
    seek <seconds>
    loop <start> <end> <on|off>
    bpm <number>
    master <0..1>
  Tracks:
    track add
    track remove <trackId>
    volume <trackId> <0..1>
    mute <trackId> <on|off>
    solo <trackId> <on|off>
    pan <trackId> <-1..1>
  Regions:
    region add <trackId> <assetId> <startTime>
    region move <trackId> <regionId> <startTime>
    region split <trackId> <regionId> <splitTime>
    region resize <trackId> <regionId> <duration>
    region remove <trackId> <regionId>
  Session:
    session export
  Special (REPL only):
    state   - print current session snapshot
    tracks  - print track list summary
    help    - show this help
    exit    - quit
`;

async function main(): Promise<void> {
  const app = createApp({
    sessionId: 'repl-session',
    idGenerator: createCounterIdGenerator(),
  });

  const rl = createInterface({ input: stdin, output: stdout });

  console.log('drop-ai-v3 REPL');
  console.log('Type "help" for commands, "exit" to quit.');
  console.log('Note: no real audio playback (no browser AudioContext).');

  rl.setPrompt('> ');
  rl.prompt();

  for await (const rawLine of rl) {
    const input = rawLine.trim();
    if (!input) {
      rl.prompt();
      continue;
    }

    if (input === 'exit' || input === 'quit') break;

    if (input === 'help') {
      console.log(HELP_TEXT);
      rl.prompt();
      continue;
    }

    if (input === 'state') {
      console.log(JSON.stringify(app.sessionStore.getState(), null, 2));
      rl.prompt();
      continue;
    }

    if (input === 'tracks') {
      const session = app.sessionStore.getState();
      if (session.trackOrder.length === 0) {
        console.log('(no tracks)');
      } else {
        for (const trackId of session.trackOrder) {
          const track = session.tracksById[trackId];
          const regionSummary =
            track.regionOrder.length === 0
              ? 'no regions'
              : track.regionOrder
                  .map(regionId => {
                    const region = track.regionsById[regionId];
                    return `${regionId}[${region.startTime}s,+${region.duration}s]`;
                  })
                  .join(', ');
          console.log(
            `${trackId}  vol=${track.volume} mute=${track.muted} solo=${track.soloed} pan=${track.pan}  ${regionSummary}`
          );
        }
      }
      rl.prompt();
      continue;
    }

    const result = await runCli(input, { appController: app.controller });
    if (result.ok) {
      const data = result.data;
      if (isExportData(data)) {
        console.log(`OK exported "${data.filename}" (${data.blob.size} bytes)`);
      } else {
        console.log('OK', data !== undefined ? JSON.stringify(data) : '');
      }
    } else {
      console.log('ERR', result.error.code, '-', result.error.message);
    }
    rl.prompt();
  }

  rl.close();
  app.dispose();
}

main().catch(err => {
  console.error('REPL crashed:', err);
  process.exit(1);
});

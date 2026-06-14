import { describe, expect, it } from 'vitest';
import {
  cliCommandRegistry,
  formatCliCommandList,
  parseRegisteredCliCommand,
} from './command-registry';

describe('cliCommandRegistry', () => {
  it('keeps command usages unique', () => {
    const usages = cliCommandRegistry.map((definition) => definition.usage);

    expect(new Set(usages).size).toBe(usages.length);
  });

  it('formats the command list from registered definitions', () => {
    const commandList = formatCliCommandList();

    expect(commandList).toContain('Playback:');
    expect(commandList).toContain(
      '  region split <trackId> <regionId> <splitTime> - Split a region at a time.'
    );
    expect(commandList).toContain(
      '  session export [filename] - Export the current session as a WAV file.'
    );
  });

  it('matches more specific command prefixes before generic prefixes', () => {
    expect(parseRegisteredCliCommand(['loop', 'off'])).toEqual({
      ok: true,
      command: {
        type: 'playback.loop.set',
        payload: { start: 0, end: 1, enabled: false },
      },
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  cliCommandCatalog,
  formatCliCommandList,
  parseRegisteredCliCommand,
} from './command-registry';

describe('cliCommandRegistry', () => {
  it('keeps command catalog usages unique', () => {
    const usages = cliCommandCatalog.map((definition) => definition.usage);

    expect(new Set(usages).size).toBe(usages.length);
  });

  it('formats the command list from registered definitions', () => {
    const commandList = formatCliCommandList();

    expect(commandList).toContain('Local:');
    expect(commandList).toContain(
      '  asset upload - Open a file picker and register the selected audio asset.'
    );
    expect(commandList).toContain('Playback:');
    expect(commandList).toContain(
      '  region split <trackId> <regionId> <splitTime> - Split a region at a time.'
    );
    expect(commandList).toContain(
      '  session export [filename] - Export the current session as a WAV file.'
    );
    expect(commandList).toContain(
      '  export range [filename] - Export the configured range as a WAV file.'
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
    expect(parseRegisteredCliCommand(['export', 'range'])).toEqual({
      ok: true,
      command: {
        type: 'session.exportRange.export',
        payload: undefined,
      },
    });
  });
});

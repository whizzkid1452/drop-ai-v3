import { describe, expect, it } from 'vitest';
import { createCallRecorder } from './call-recorder';
import { createTestIdGenerator } from './id-generator';

describe('controller test fixtures', () => {
  it('records method calls for controller dependency assertions', () => {
    const recorder = createCallRecorder();

    recorder.record('play');
    recorder.record('setVolume', [0.5]);

    expect(recorder.calls).toEqual([
      { method: 'play', args: [] },
      { method: 'setVolume', args: [0.5] },
    ]);
    expect(recorder.getCalls('play')).toEqual([{ method: 'play', args: [] }]);
  });

  it('creates deterministic ids for controller tests', () => {
    const idGenerator = createTestIdGenerator();

    expect(idGenerator.next('track')).toBe('track-1');
    expect(idGenerator.next('track')).toBe('track-2');

    idGenerator.reset();

    expect(idGenerator.next('region')).toBe('region-1');
  });
});

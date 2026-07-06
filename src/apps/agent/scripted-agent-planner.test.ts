import { describe, expect, it } from 'vitest';
import { agentCommandCatalog } from './agent-command-catalog';
import { createAgentSessionSummary } from './agent-session-summary';
import { ScriptedAgentPlanner } from './scripted-agent-planner';

describe('ScriptedAgentPlanner', () => {
  it('returns the script that matches the request text', async () => {
    const planner = new ScriptedAgentPlanner({
      scripts: {
        preview: {
          steps: [
            {
              command: {
                type: 'session.exportRange.start.set',
                payload: { seconds: 1 },
              },
              id: 'step-1',
              reason: 'Set range start.',
            },
          ],
        },
      },
    });

    await expect(
      planner.createPlan({
        commandCatalog: agentCommandCatalog,
        requestText: 'preview',
        sessionSummary: createAgentSessionSummary(createSessionSummarySource()),
      })
    ).resolves.toEqual({
      steps: [
        {
          command: {
            type: 'session.exportRange.start.set',
            payload: { seconds: 1 },
          },
          id: 'step-1',
          reason: 'Set range start.',
        },
      ],
    });
  });

  it('returns an empty draft when no script matches', async () => {
    const planner = new ScriptedAgentPlanner({ scripts: {} });

    await expect(
      planner.createPlan({
        commandCatalog: agentCommandCatalog,
        requestText: 'unknown',
        sessionSummary: createAgentSessionSummary(createSessionSummarySource()),
      })
    ).resolves.toEqual({ steps: [] });
  });
});

function createSessionSummarySource() {
  return {
    exportRange: {
      endSeconds: 4,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      startSeconds: 0,
    },
    id: 'session-1',
    playback: {
      bpm: 120,
      loop: {
        enabled: false,
        end: 4,
        start: 0,
      },
      masterVolume: 1,
      playing: false,
      positionSeconds: 0,
    },
    trackOrder: [],
    tracksById: {},
  };
}

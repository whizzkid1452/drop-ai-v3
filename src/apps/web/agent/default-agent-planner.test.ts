import { describe, expect, it } from 'vitest';
import { HttpAgentPlanner } from '@/apps/agent/planner-adapters/http-agent-planner';
import { WebLLMAgentPlanner } from '@/apps/agent/planner-adapters/webllm-agent-planner';
import { createAgentSessionSummary } from '@/apps/agent/agent-session-summary';
import { agentCommandCatalog } from '@/apps/agent/agent-command-catalog';
import { createDefaultAgentPlanner } from './default-agent-planner';

describe('createDefaultAgentPlanner', () => {
  it('uses the WebLLM planner when no provider is configured', () => {
    const planner = createDefaultAgentPlanner({ environment: {} });

    expect(planner).toBeInstanceOf(WebLLMAgentPlanner);
  });

  it('uses the scripted planner when the scripted provider is configured', async () => {
    const planner = createDefaultAgentPlanner({
      environment: { VITE_AGENT_PLANNER_PROVIDER: 'scripted' },
    });

    const draft = await planner.createPlan({
      commandCatalog: agentCommandCatalog,
      requestText: ' PLAY ',
      sessionSummary: createEmptySessionSummary(),
    });

    expect(draft).toEqual({
      steps: [
        {
          command: { type: 'playback.play' },
          id: 'step-1',
          reason: 'Start playback.',
        },
      ],
    });
  });

  it('uses the HTTP planner when the http provider and endpoint are configured', () => {
    const planner = createDefaultAgentPlanner({
      environment: {
        VITE_AGENT_PLANNER_ENDPOINT: '/api/agent/plan',
        VITE_AGENT_PLANNER_PROVIDER: 'http',
      },
    });

    expect(planner).toBeInstanceOf(HttpAgentPlanner);
  });

  it('requires an endpoint when the http provider is configured', () => {
    expect(() =>
      createDefaultAgentPlanner({
        environment: { VITE_AGENT_PLANNER_PROVIDER: 'http' },
      })
    ).toThrow(
      'VITE_AGENT_PLANNER_ENDPOINT is required when VITE_AGENT_PLANNER_PROVIDER is "http".'
    );
  });

  it('uses the WebLLM planner when the webllm provider is configured', () => {
    const planner = createDefaultAgentPlanner({
      environment: {
        VITE_AGENT_PLANNER_PROVIDER: 'webllm',
        VITE_AGENT_WEBLLM_MODEL_ID: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
      },
    });

    expect(planner).toBeInstanceOf(WebLLMAgentPlanner);
  });

  it('rejects unsupported provider names', () => {
    expect(() =>
      createDefaultAgentPlanner({
        environment: { VITE_AGENT_PLANNER_PROVIDER: 'unknown' },
      })
    ).toThrow('Unsupported agent planner provider: unknown.');
  });
});

function createEmptySessionSummary() {
  return createAgentSessionSummary({
    exportRange: {
      endSeconds: 0,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      startSeconds: 0,
    },
    id: 'session-1',
    playback: {
      bpm: 120,
      loop: {
        enabled: false,
        end: 0,
        start: 0,
      },
      masterVolume: 1,
      playing: false,
      positionSeconds: 0,
    },
    trackOrder: [],
    tracksById: {},
  });
}

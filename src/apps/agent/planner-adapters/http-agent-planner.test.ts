import { afterEach, describe, expect, it, vi } from 'vitest';
import { agentCommandCatalog } from '../agent-command-catalog';
import { createAgentSessionSummary } from '../agent-session-summary';
import type { AgentPlanningInput } from '../agent-workflow';
import {
  HttpAgentPlanner,
  type AgentPlannerFetch,
  type HttpAgentPlannerRequestBody,
} from './http-agent-planner';

afterEach(() => {
  vi.useRealTimers();
});

describe('HttpAgentPlanner', () => {
  it('posts planning input and returns an agent plan draft', async () => {
    const fetch = createJsonFetch({
      steps: [
        {
          command: { type: 'playback.play' },
          id: 'step-1',
          reason: 'Start playback.',
        },
      ],
    });
    const planner = new HttpAgentPlanner({
      endpoint: '/api/agent/plan',
      fetch,
    });

    const draft = await planner.createPlan(createPlanningInput());

    expect(draft).toEqual({
      steps: [
        {
          command: { type: 'playback.play' },
          id: 'step-1',
          reason: 'Start playback.',
        },
      ],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getRequestBody(fetch)).toMatchObject({
      requestText: 'play',
      sessionSummary: {
        sessionId: 'session-1',
      },
    });
  });

  it('does not send attachment command examples to the planner endpoint', async () => {
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });
    const fetch = createJsonFetch({ steps: [] });
    const planner = new HttpAgentPlanner({
      endpoint: '/api/agent/plan',
      fetch,
    });

    await planner.createPlan(
      createPlanningInput({
        commandCatalog: [
          {
            availability: 'requiresUserAttachment',
            description: 'Register a file.',
            examples: [{ type: 'asset.register', payload: { file } }],
            payloadDescription: '{ file: File selected by user }',
            title: 'Register Asset',
            type: 'asset.register',
          },
        ],
      })
    );

    const requestBody = getRequestBody(fetch);

    expect(requestBody.commandCatalog).toEqual([
      {
        availability: 'requiresUserAttachment',
        description: 'Register a file.',
        examples: [],
        payloadDescription: '{ file: File selected by user }',
        title: 'Register Asset',
        type: 'asset.register',
      },
    ]);
  });

  it('rejects non-2xx responses as planning failures', async () => {
    const planner = new HttpAgentPlanner({
      endpoint: '/api/agent/plan',
      fetch: createResponseFetch(new Response('failed', { status: 500 })),
    });

    await expect(planner.createPlan(createPlanningInput())).rejects.toThrow(
      'Agent planner request failed with HTTP 500.'
    );
  });

  it('rejects invalid JSON responses as planning failures', async () => {
    const planner = new HttpAgentPlanner({
      endpoint: '/api/agent/plan',
      fetch: createResponseFetch(
        new Response('not-json', {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      ),
    });

    await expect(planner.createPlan(createPlanningInput())).rejects.toThrow(
      'Agent planner response must be valid JSON.'
    );
  });

  it('rejects responses without a steps field as planning failures', async () => {
    const planner = new HttpAgentPlanner({
      endpoint: '/api/agent/plan',
      fetch: createJsonFetch({ plan: { steps: [] } }),
    });

    await expect(planner.createPlan(createPlanningInput())).rejects.toThrow(
      'Agent planner response must include a steps field.'
    );
  });

  it('aborts requests after the configured timeout', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<AgentPlannerFetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        })
    );
    const planner = new HttpAgentPlanner({
      endpoint: '/api/agent/plan',
      fetch,
      timeoutMs: 50,
    });

    const planPromise = planner.createPlan(createPlanningInput());
    const expectation = expect(planPromise).rejects.toThrow(
      'Agent planner request timed out.'
    );

    await vi.advanceTimersByTimeAsync(50);

    await expectation;
  });
});

function createPlanningInput(
  overrides: Partial<AgentPlanningInput> = {}
): AgentPlanningInput {
  return {
    commandCatalog: agentCommandCatalog,
    requestText: 'play',
    sessionSummary: createAgentSessionSummary({
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
    }),
    ...overrides,
  };
}

function createJsonFetch(
  value: unknown
): ReturnType<typeof vi.fn<AgentPlannerFetch>> {
  return createResponseFetch(
    new Response(JSON.stringify(value), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  );
}

function createResponseFetch(
  response: Response
): ReturnType<typeof vi.fn<AgentPlannerFetch>> {
  return vi.fn<AgentPlannerFetch>(async () => response);
}

function getRequestBody(
  fetch: ReturnType<typeof vi.fn<AgentPlannerFetch>>
): HttpAgentPlannerRequestBody {
  const body = fetch.mock.calls[0]?.[1]?.body;

  if (typeof body !== 'string') {
    throw new Error('Expected planner request body to be a string.');
  }

  return JSON.parse(body) as HttpAgentPlannerRequestBody;
}

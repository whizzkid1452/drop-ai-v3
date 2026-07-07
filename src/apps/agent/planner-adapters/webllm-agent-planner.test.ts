import { describe, expect, it, vi } from 'vitest';
import { agentCommandCatalog } from '../agent-command-catalog';
import { createAgentSessionSummary } from '../agent-session-summary';
import type { AgentPlanningInput } from '../agent-workflow';
import {
  WebLLMAgentPlanner,
  type WebLLMChatCompletionRequest,
  type WebLLMEngineFactory,
  type WebLLMInitProgressCallback,
  type WebLLMPlannerEngine,
} from './webllm-agent-planner';

type WebLLMCompletionCreateMock = ReturnType<
  typeof vi.fn<WebLLMPlannerEngine['chat']['completions']['create']>
>;

interface FakeWebLLMPlannerEngine extends WebLLMPlannerEngine {
  chat: {
    completions: {
      create: WebLLMCompletionCreateMock;
    };
  };
}

describe('WebLLMAgentPlanner', () => {
  it('requests a JSON chat completion and returns an agent plan draft', async () => {
    const engine = createEngineReturning(
      JSON.stringify({
        steps: [
          {
            command: { type: 'playback.play' },
            id: 'step-1',
            reason: 'Start playback.',
          },
        ],
      })
    );
    const planner = new WebLLMAgentPlanner({
      engineFactory: createEngineFactory(engine),
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

    const completionRequest = getCompletionRequest(engine);

    expect(completionRequest).toMatchObject({
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      temperature: 0,
    });
    expect(completionRequest.messages[0]).toMatchObject({
      role: 'system',
    });
    expect(getPromptPayload(completionRequest)).toMatchObject({
      requestText: 'play',
      sessionSummary: {
        sessionId: 'session-1',
      },
    });
  });

  it('passes model loading options to the engine factory and reuses the loaded engine', async () => {
    const engine = createEngineReturning(JSON.stringify({ steps: [] }));
    const engineFactory = createEngineFactory(engine);
    const initProgressCallback = vi.fn<WebLLMInitProgressCallback>();
    const planner = new WebLLMAgentPlanner({
      engineFactory,
      initProgressCallback,
      modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    });

    await planner.createPlan(createPlanningInput());
    await planner.createPlan(createPlanningInput());

    expect(engineFactory).toHaveBeenCalledTimes(1);
    expect(engineFactory).toHaveBeenCalledWith({
      initProgressCallback,
      modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    });
    expect(engine.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it('preloads the engine and reuses it for planning', async () => {
    const engine = createEngineReturning(
      JSON.stringify({
        steps: [
          {
            command: { type: 'playback.play' },
            id: 'step-1',
            reason: 'Start playback.',
          },
        ],
      })
    );
    const engineFactory = createEngineFactory(engine);
    const planner = new WebLLMAgentPlanner({ engineFactory });

    await planner.preload();
    const draft = await planner.createPlan(createPlanningInput());

    expect(engineFactory).toHaveBeenCalledTimes(1);
    expect(draft.steps).toEqual([
      {
        command: { type: 'playback.play' },
        id: 'step-1',
        reason: 'Start playback.',
      },
    ]);
  });

  it('does not send attachment command examples to WebLLM', async () => {
    const file = new File(['audio'], 'loop.wav', { type: 'audio/wav' });
    const engine = createEngineReturning(JSON.stringify({ steps: [] }));
    const planner = new WebLLMAgentPlanner({
      engineFactory: createEngineFactory(engine),
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

    expect(
      getPromptPayload(getCompletionRequest(engine)).commandCatalog
    ).toEqual([
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

  it('rejects empty completion content as a planning failure', async () => {
    const planner = new WebLLMAgentPlanner({
      engineFactory: createEngineFactory(createEngineReturning(null)),
    });

    await expect(planner.createPlan(createPlanningInput())).rejects.toThrow(
      'WebLLM planner response must include message content.'
    );
  });

  it('rejects invalid JSON completion content as a planning failure', async () => {
    const planner = new WebLLMAgentPlanner({
      engineFactory: createEngineFactory(createEngineReturning('not-json')),
    });

    await expect(planner.createPlan(createPlanningInput())).rejects.toThrow(
      'WebLLM planner response must be valid JSON.'
    );
  });

  it('rejects completion content without a steps field as a planning failure', async () => {
    const planner = new WebLLMAgentPlanner({
      engineFactory: createEngineFactory(
        createEngineReturning(JSON.stringify({ plan: { steps: [] } }))
      ),
    });

    await expect(planner.createPlan(createPlanningInput())).rejects.toThrow(
      'WebLLM planner response must include a steps field.'
    );
  });

  it('propagates model loading failure as a planning failure', async () => {
    const planner = new WebLLMAgentPlanner({
      engineFactory: vi.fn<WebLLMEngineFactory>(async () => {
        throw new Error('Model loading failed.');
      }),
    });

    await expect(planner.createPlan(createPlanningInput())).rejects.toThrow(
      'Model loading failed.'
    );
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

function createEngineReturning(
  content: string | null
): FakeWebLLMPlannerEngine {
  return {
    chat: {
      completions: {
        create: vi.fn(async () => ({
          choices: [
            {
              message: { content },
            },
          ],
        })),
      },
    },
  };
}

function createEngineFactory(
  engine: WebLLMPlannerEngine
): ReturnType<typeof vi.fn<WebLLMEngineFactory>> {
  return vi.fn<WebLLMEngineFactory>(async () => engine);
}

function getCompletionRequest(
  engine: FakeWebLLMPlannerEngine
): WebLLMChatCompletionRequest {
  const request = engine.chat.completions.create.mock.calls[0]?.[0];

  if (!request) {
    throw new Error('Expected WebLLM completion request.');
  }

  return request;
}

function getPromptPayload(
  request: WebLLMChatCompletionRequest
): Record<string, unknown> {
  const userMessage = request.messages.find(
    (message) => message.role === 'user'
  );

  if (!userMessage) {
    throw new Error('Expected WebLLM user prompt.');
  }

  return JSON.parse(userMessage.content) as Record<string, unknown>;
}

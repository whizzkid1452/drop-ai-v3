import type { AgentPlanDraft } from '../agent-plan';
import type { AgentPlanningInput, IAgentPlanner } from '../agent-workflow';
import { createAgentPlannerCommandDefinitions } from './agent-planner-command-definition';

const DEFAULT_WEBLLM_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
const DEFAULT_MAX_TOKENS = 1_000;
const DEFAULT_TEMPERATURE = 0;

export interface WebLLMInitProgressReport {
  progress: number;
  timeElapsed: number;
  text: string;
}

export type WebLLMInitProgressCallback = (
  report: WebLLMInitProgressReport
) => void;

export interface WebLLMEngineFactoryInput {
  modelId: string;
  initProgressCallback?: WebLLMInitProgressCallback;
}

export type WebLLMEngineFactory = (
  input: WebLLMEngineFactoryInput
) => Promise<WebLLMPlannerEngine>;

export interface WebLLMAgentPlannerDependencies {
  engineFactory?: WebLLMEngineFactory;
  initProgressCallback?: WebLLMInitProgressCallback;
  maxTokens?: number;
  modelId?: string;
  temperature?: number;
}

export interface WebLLMPlannerEngine {
  chat: {
    completions: {
      create: (
        request: WebLLMChatCompletionRequest
      ) => Promise<WebLLMChatCompletion>;
    };
  };
}

export interface WebLLMChatCompletionRequest {
  messages: WebLLMChatCompletionMessage[];
  max_tokens: number;
  temperature: number;
}

export interface WebLLMChatCompletionMessage {
  role: 'system' | 'user';
  content: string;
}

export interface WebLLMChatCompletion {
  choices: WebLLMChatCompletionChoice[];
}

export interface WebLLMChatCompletionChoice {
  message: {
    content: string | null;
  };
}

interface WebLLMPlannerPromptPayload {
  requestText: string;
  sessionSummary: AgentPlanningInput['sessionSummary'];
  commandCatalog: ReturnType<typeof createAgentPlannerCommandDefinitions>;
}

export class WebLLMAgentPlanner implements IAgentPlanner {
  private readonly engineFactory: WebLLMEngineFactory;
  private readonly initProgressCallback?: WebLLMInitProgressCallback;
  private readonly maxTokens: number;
  private readonly modelId: string;
  private readonly temperature: number;
  private enginePromise: Promise<WebLLMPlannerEngine> | null = null;

  constructor({
    engineFactory = createDefaultWebLLMEngine,
    initProgressCallback,
    maxTokens = DEFAULT_MAX_TOKENS,
    modelId = DEFAULT_WEBLLM_MODEL_ID,
    temperature = DEFAULT_TEMPERATURE,
  }: WebLLMAgentPlannerDependencies = {}) {
    this.engineFactory = engineFactory;
    this.initProgressCallback = initProgressCallback;
    this.maxTokens = maxTokens;
    this.modelId = modelId;
    this.temperature = temperature;
  }

  async createPlan(input: AgentPlanningInput): Promise<AgentPlanDraft> {
    const engine = await this.getEngine();
    const completion = await engine.chat.completions.create({
      max_tokens: this.maxTokens,
      messages: createWebLLMMessages(input),
      temperature: this.temperature,
    });
    const content = completion.choices[0]?.message.content;

    if (!content) {
      throw new Error('WebLLM planner response must include message content.');
    }

    return parsePlanDraftContent(content);
  }

  private async getEngine(): Promise<WebLLMPlannerEngine> {
    this.enginePromise ??= this.engineFactory({
      initProgressCallback: this.initProgressCallback,
      modelId: this.modelId,
    });

    return await this.enginePromise;
  }
}

function createWebLLMMessages(
  input: AgentPlanningInput
): WebLLMChatCompletionMessage[] {
  return [
    {
      content: createSystemPrompt(),
      role: 'system',
    },
    {
      content: JSON.stringify(createPromptPayload(input)),
      role: 'user',
    },
  ];
}

function createSystemPrompt(): string {
  return [
    'You convert a Drop AI user request into an AgentPlanDraft JSON object.',
    'Return only valid JSON with this shape: {"steps":[{"id":"step-1","reason":"...","command":{"type":"...","payload":{}}}]}',
    'Use only commandCatalog entries whose availability is "agent".',
    'Do not create File, Blob, or object URL payloads.',
    'Do not execute commands. Only propose command steps for user approval.',
  ].join('\n');
}

function createPromptPayload(
  input: AgentPlanningInput
): WebLLMPlannerPromptPayload {
  return {
    commandCatalog: createAgentPlannerCommandDefinitions(input.commandCatalog),
    requestText: input.requestText,
    sessionSummary: input.sessionSummary,
  };
}

function parsePlanDraftContent(content: string): AgentPlanDraft {
  let value: unknown;

  try {
    value = JSON.parse(content);
  } catch {
    throw new Error('WebLLM planner response must be valid JSON.');
  }

  if (!isRecord(value) || !('steps' in value)) {
    throw new Error('WebLLM planner response must include a steps field.');
  }

  return { steps: value.steps };
}

async function createDefaultWebLLMEngine({
  initProgressCallback,
  modelId,
}: WebLLMEngineFactoryInput): Promise<WebLLMPlannerEngine> {
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

  return await CreateMLCEngine(modelId, { initProgressCallback });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

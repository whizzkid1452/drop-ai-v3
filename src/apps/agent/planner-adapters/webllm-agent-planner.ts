import type { AgentPlanDraft } from '../agent-plan';
import type {
  AgentChatMessage,
  AgentResponseDraft,
  AgentResponseInput,
  IAgentResponder,
} from '../agent-chat';
import type { AgentPlanningInput, IAgentPlanner } from '../agent-workflow';
import { createAgentPlannerCommandDefinitions } from './agent-planner-command-definition';

const DEFAULT_WEBLLM_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
const DEFAULT_MAX_TOKENS = 1_000;
const DEFAULT_TEMPERATURE = 0;
const RESPONSE_SCHEMA_OBJECT_TYPE = 'object';
const COMMAND_SELECTION_RULES = [
  'First match requestText intent to commandCatalog. Do not default to playback.play.',
  'Use playback.play only when the user explicitly asks to start, resume, or play from the current position.',
  'For pause or stop requests, use playback.pause or playback.stop instead of playback.play.',
  'For time navigation requests, use playback.seek with payload.seconds.',
  'For export range preview requests, set session.exportRange.start.set, set session.exportRange.end.set, then use session.exportRange.preview.play.',
  'For range WAV download requests, set range boundaries when the user gives them, then use session.exportRange.export.',
  'For full-session WAV download requests, use session.export.',
  'For track, region, volume, pan, mute, solo, fade, BPM, or loop requests, use the matching non-play command from commandCatalog.',
  'If no commandCatalog entry matches the request, return {"steps":[]}.',
] as const;
const COMMAND_SELECTION_EXAMPLES = [
  {
    commandTypes: ['playback.play'],
    requestText: '재생해줘',
  },
  {
    commandTypes: ['playback.pause'],
    requestText: '잠깐 멈춰줘',
  },
  {
    commandTypes: ['playback.stop'],
    requestText: '정지하고 처음으로 돌아가',
  },
  {
    commandTypes: ['playback.seek'],
    requestText: '10초 위치로 이동해줘',
  },
  {
    commandTypes: [
      'session.exportRange.start.set',
      'session.exportRange.end.set',
      'session.exportRange.preview.play',
    ],
    requestText: '1초부터 3초까지 미리 들어볼래',
  },
  {
    commandTypes: [
      'session.exportRange.start.set',
      'session.exportRange.end.set',
      'session.exportRange.export',
    ],
    requestText: '1초부터 3초까지 wav로 내보내줘',
  },
  {
    commandTypes: ['session.export'],
    requestText: '전체 세션을 wav로 다운로드해줘',
  },
] as const;

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
  response_format: { type: 'json_object'; schema: string };
  temperature: number;
}

export interface WebLLMChatCompletionMessage {
  role: 'assistant' | 'system' | 'user';
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
  availableCommandTypes: string[];
  commandCatalog: ReturnType<typeof createAgentPlannerCommandDefinitions>;
  intentExamples: readonly CommandSelectionExample[];
  commandSelectionRules: readonly string[];
}

interface WebLLMResponsePromptPayload {
  requestText: string;
  conversationMessages: readonly AgentChatMessage[];
  sessionSummary: AgentResponseInput['sessionSummary'];
  availableCommandTypes: string[];
  commandCatalog: ReturnType<typeof createAgentPlannerCommandDefinitions>;
  intentExamples: readonly CommandSelectionExample[];
  commandSelectionRules: readonly string[];
}

interface CommandSelectionExample {
  requestText: string;
  commandTypes: readonly string[];
}

export class WebLLMAgentPlanner implements IAgentPlanner, IAgentResponder {
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
      response_format: {
        schema: createAgentPlanDraftResponseSchema(input),
        type: 'json_object',
      },
      temperature: this.temperature,
    });
    const content = completion.choices[0]?.message.content;

    if (!content) {
      throw new Error('WebLLM planner response must include message content.');
    }

    return parsePlanDraftContent(content, input.commandCatalog);
  }

  async createResponse(input: AgentResponseInput): Promise<AgentResponseDraft> {
    const engine = await this.getEngine();
    const completion = await engine.chat.completions.create({
      max_tokens: this.maxTokens,
      messages: createWebLLMResponseMessages(input),
      response_format: {
        schema: createAgentResponseDraftResponseSchema(input),
        type: 'json_object',
      },
      temperature: this.temperature,
    });
    const content = completion.choices[0]?.message.content;

    if (!content) {
      throw new Error(
        'WebLLM responder response must include message content.'
      );
    }

    return parseResponseDraftContent(content, input.commandCatalog);
  }

  async preload(): Promise<void> {
    await this.getEngine();
  }

  private async getEngine(): Promise<WebLLMPlannerEngine> {
    this.enginePromise ??= this.createEngine();

    try {
      return await this.enginePromise;
    } catch (error) {
      this.enginePromise = null;
      throw error;
    }
  }

  private async createEngine(): Promise<WebLLMPlannerEngine> {
    return await this.engineFactory({
      initProgressCallback: this.initProgressCallback,
      modelId: this.modelId,
    });
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

function createWebLLMResponseMessages(
  input: AgentResponseInput
): WebLLMChatCompletionMessage[] {
  return [
    {
      content: createResponseSystemPrompt(),
      role: 'system',
    },
    {
      content: JSON.stringify(createResponsePromptPayload(input)),
      role: 'user',
    },
  ];
}

function createSystemPrompt(): string {
  return [
    'You convert a Drop AI user request into an AgentPlanDraft JSON object.',
    'Return only valid JSON with this shape: {"steps":[{"id":"step-1","reason":"...","command":{"type":"..."}}]} or {"steps":[]}.',
    'Put reason only on the step object. Do not put reason inside command.',
    'Use only commandCatalog entries whose availability is "agent".',
    'availableCommandTypes contains the complete list of command types you may return.',
    'Set command.type to one exact commandCatalog type string. Do not translate, rename, abbreviate, or invent command types.',
    'Use payload keys exactly as shown in payloadDescription and examples.',
    'Include command.payload only when payloadDescription is not "No payload.".',
    'Never choose playback.play as a fallback for unclear, export, edit, range, stop, pause, seek, or setup requests.',
    'Do not create File, Blob, or object URL payloads.',
    'Do not execute commands. Only propose command steps for user approval.',
    'Command selection rules:',
    ...COMMAND_SELECTION_RULES.map((rule) => `- ${rule}`),
    'Korean intent examples:',
    ...COMMAND_SELECTION_EXAMPLES.map(formatCommandSelectionExample),
  ].join('\n');
}

function createResponseSystemPrompt(): string {
  return [
    'You are Drop AI, a chat assistant inside a browser digital audio workstation (DAW).',
    'Return only valid JSON with this shape: {"message":"...","steps":[...]}',
    'message is the assistant chat response shown to the user. Write it in the same language as the latest user request.',
    'Use steps only when the user explicitly asks to control playback, edit tracks or regions, set export ranges, or export audio.',
    'If steps has entries, message must say the action is ready for review and not claim it has already been executed.',
    'If the user asks a question, asks for advice, or gives an unclear request, answer normally and set steps to [].',
    'Use only commandCatalog entries whose availability is "agent".',
    'availableCommandTypes contains the complete list of command types you may return.',
    'Set command.type to one exact commandCatalog type string. Do not translate, rename, abbreviate, or invent command types.',
    'Use payload keys exactly as shown in payloadDescription and examples.',
    'Include command.payload only when payloadDescription is not "No payload.".',
    'Never choose playback.play as a fallback for unclear, export, edit, range, stop, pause, seek, setup, or general chat requests.',
    'Do not create File, Blob, or object URL payloads.',
    'Do not execute commands. Only propose command steps for user approval.',
    'Command selection rules:',
    ...COMMAND_SELECTION_RULES.map((rule) => `- ${rule}`),
    'Korean intent examples:',
    ...COMMAND_SELECTION_EXAMPLES.map(formatCommandSelectionExample),
  ].join('\n');
}

function createPromptPayload(
  input: AgentPlanningInput
): WebLLMPlannerPromptPayload {
  return {
    availableCommandTypes: createAvailableAgentCommandTypes(input),
    commandCatalog: createAgentPlannerCommandDefinitions(input.commandCatalog),
    intentExamples: COMMAND_SELECTION_EXAMPLES,
    commandSelectionRules: COMMAND_SELECTION_RULES,
    requestText: input.requestText,
    sessionSummary: input.sessionSummary,
  };
}

function createResponsePromptPayload(
  input: AgentResponseInput
): WebLLMResponsePromptPayload {
  return {
    availableCommandTypes: createAvailableAgentCommandTypes(input),
    commandCatalog: createAgentPlannerCommandDefinitions(input.commandCatalog),
    commandSelectionRules: COMMAND_SELECTION_RULES,
    conversationMessages: input.messages,
    intentExamples: COMMAND_SELECTION_EXAMPLES,
    requestText: input.requestText,
    sessionSummary: input.sessionSummary,
  };
}

function formatCommandSelectionExample(
  example: CommandSelectionExample
): string {
  return `- ${example.requestText} -> ${example.commandTypes.join(', ')}`;
}

function createAgentPlanDraftResponseSchema(input: AgentPlanningInput): string {
  return JSON.stringify({
    additionalProperties: false,
    properties: {
      steps: {
        items: createAgentPlanStepResponseSchema(input),
        type: 'array',
      },
    },
    required: ['steps'],
    type: RESPONSE_SCHEMA_OBJECT_TYPE,
  });
}

function createAgentResponseDraftResponseSchema(
  input: AgentResponseInput
): string {
  return JSON.stringify({
    additionalProperties: false,
    properties: {
      message: { type: 'string' },
      steps: {
        items: createAgentPlanStepResponseSchema(input),
        type: 'array',
      },
    },
    required: ['message', 'steps'],
    type: RESPONSE_SCHEMA_OBJECT_TYPE,
  });
}

function createAgentPlanStepResponseSchema(
  input: AgentPlanningInput | AgentResponseInput
): {
  additionalProperties: false;
  properties: {
    command: {
      additionalProperties: false;
      properties: {
        payload: {
          additionalProperties: true;
          type: typeof RESPONSE_SCHEMA_OBJECT_TYPE;
        };
        type: ReturnType<typeof createCommandTypeResponseSchema>;
      };
      required: ['type'];
      type: typeof RESPONSE_SCHEMA_OBJECT_TYPE;
    };
    id: { type: 'string' };
    reason: { type: 'string' };
  };
  required: ['id', 'reason', 'command'];
  type: typeof RESPONSE_SCHEMA_OBJECT_TYPE;
} {
  return {
    additionalProperties: false,
    properties: {
      command: {
        additionalProperties: false,
        properties: {
          payload: {
            additionalProperties: true,
            type: RESPONSE_SCHEMA_OBJECT_TYPE,
          },
          type: createCommandTypeResponseSchema(input),
        },
        required: ['type'],
        type: RESPONSE_SCHEMA_OBJECT_TYPE,
      },
      id: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['id', 'reason', 'command'],
    type: RESPONSE_SCHEMA_OBJECT_TYPE,
  };
}

function createCommandTypeResponseSchema(
  input: AgentPlanningInput | AgentResponseInput
): {
  enum?: string[];
  type: 'string';
} {
  const agentCommandTypes = createAvailableAgentCommandTypes(input);

  if (agentCommandTypes.length === 0) {
    return { type: 'string' };
  }

  return {
    enum: agentCommandTypes,
    type: 'string',
  };
}

function createAvailableAgentCommandTypes(
  input: AgentPlanningInput | AgentResponseInput
): string[] {
  return input.commandCatalog
    .filter((definition) => definition.availability === 'agent')
    .map((definition) => definition.type);
}

function parsePlanDraftContent(
  content: string,
  commandCatalog: AgentPlanningInput['commandCatalog']
): AgentPlanDraft {
  let value: unknown;

  try {
    value = JSON.parse(content);
  } catch {
    throw new Error('WebLLM planner response must be valid JSON.');
  }

  if (!isRecord(value) || !('steps' in value)) {
    throw new Error('WebLLM planner response must include a steps field.');
  }

  return {
    steps: normalizePlanDraftSteps({
      commandCatalog,
      steps: value.steps,
    }),
  };
}

function parseResponseDraftContent(
  content: string,
  commandCatalog: AgentResponseInput['commandCatalog']
): AgentResponseDraft {
  let value: unknown;

  try {
    value = JSON.parse(content);
  } catch {
    throw new Error('WebLLM responder response must be valid JSON.');
  }

  if (!isRecord(value) || !('message' in value) || !('steps' in value)) {
    throw new Error(
      'WebLLM responder response must include message and steps fields.'
    );
  }

  if (typeof value.message !== 'string' || value.message.trim().length === 0) {
    throw new Error(
      'WebLLM responder response message must be a non-empty string.'
    );
  }

  if (!Array.isArray(value.steps)) {
    throw new Error('WebLLM responder response steps must be an array.');
  }

  return {
    message: value.message.trim(),
    steps: normalizePlanDraftSteps({
      commandCatalog,
      steps: value.steps,
    }),
  };
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

function normalizePlanDraftSteps({
  commandCatalog,
  steps,
}: {
  commandCatalog: AgentPlanningInput['commandCatalog'];
  steps: unknown;
}): unknown {
  if (!Array.isArray(steps)) {
    return steps;
  }

  const noPayloadCommandTypes = createNoPayloadCommandTypeSet(commandCatalog);

  return steps.map((step) =>
    normalizePlanDraftStep({ noPayloadCommandTypes, step })
  );
}

function createNoPayloadCommandTypeSet(
  commandCatalog: AgentPlanningInput['commandCatalog']
): ReadonlySet<string> {
  return new Set(
    commandCatalog
      .filter((definition) => definition.payloadDescription === 'No payload.')
      .map((definition) => definition.type)
  );
}

function normalizePlanDraftStep({
  noPayloadCommandTypes,
  step,
}: {
  noPayloadCommandTypes: ReadonlySet<string>;
  step: unknown;
}): unknown {
  if (!isRecord(step) || !isRecord(step.command)) {
    return step;
  }

  const normalizedCommand = normalizePlanDraftCommand({
    command: step.command,
    noPayloadCommandTypes,
  });
  const normalizedStep: Record<string, unknown> = {
    ...step,
    command: normalizedCommand,
  };
  const commandReason = step.command.reason;

  if (
    !('reason' in normalizedStep) &&
    typeof commandReason === 'string' &&
    commandReason.length > 0
  ) {
    normalizedStep.reason = commandReason;
  }

  return normalizedStep;
}

function normalizePlanDraftCommand({
  command,
  noPayloadCommandTypes,
}: {
  command: Record<string, unknown>;
  noPayloadCommandTypes: ReadonlySet<string>;
}): Record<string, unknown> {
  const normalizedCommand = { ...command };
  const commandType = normalizedCommand.type;

  delete normalizedCommand.reason;

  if (
    typeof commandType === 'string' &&
    noPayloadCommandTypes.has(commandType) &&
    isEmptyRecord(normalizedCommand.payload)
  ) {
    delete normalizedCommand.payload;
  }

  return normalizedCommand;
}

function isEmptyRecord(value: unknown): value is Record<string, never> {
  return isRecord(value) && Object.keys(value).length === 0;
}

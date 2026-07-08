import { agentCommandCatalog } from './agent-command-catalog';
import type { AgentCommandDefinition } from './agent-command-catalog';
import type { AgentCommandPlan, AgentPlanDraft } from './agent-plan';
import {
  createAgentSessionSummary,
  createAgentSessionSummaryFingerprint,
  type AgentSessionSummary,
  type AgentSessionSummarySource,
} from './agent-session-summary';
import {
  validateAgentPlanDraft,
  type AgentPlanValidationError,
} from './agent-plan-validator';
import type {
  AgentPlanningInput,
  ApproveAgentPlanInput,
  ApproveAgentPlanResult,
  IAgentPlanner,
  RejectAgentPlanInput,
} from './agent-workflow';
import { AgentWorkflow } from './agent-workflow';

export type AgentChatRole = 'assistant' | 'user';

export interface AgentChatMessage {
  role: AgentChatRole;
  content: string;
}

export interface AgentResponseInput {
  requestText: string;
  messages: readonly AgentChatMessage[];
  sessionSummary: AgentSessionSummary;
  commandCatalog: readonly AgentCommandDefinition[];
}

export interface AgentResponseDraft {
  message: string;
  steps: unknown;
}

export interface IAgentResponder {
  createResponse(input: AgentResponseInput): Promise<AgentResponseDraft>;
}

export interface AgentChatWorkflowDependencies {
  responder: IAgentResponder;
  planWorkflow: AgentWorkflow;
  getSessionState: () => AgentSessionSummarySource;
  createPlanId?: () => string;
}

export interface SendAgentMessageInput {
  requestText: string;
  messages: readonly AgentChatMessage[];
}

export type SendAgentMessageResult =
  | {
      ok: true;
      assistantMessage: string;
      plan: AgentCommandPlan | null;
    }
  | {
      ok: false;
      errors: SendAgentMessageError[];
    };

export type SendAgentMessageError =
  | AgentPlanValidationError
  | AgentResponseFailure
  | InvalidAgentResponseError;

export interface AgentResponseFailure {
  code: 'AGENT_RESPONSE_FAILED';
  message: string;
}

export interface InvalidAgentResponseError {
  code: 'INVALID_AGENT_RESPONSE';
  message: string;
}

const KOREAN_TEXT_PATTERN = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;
const COMMAND_INTENT_PATTERNS = [
  /play|start|resume|pause|stop|seek|export|download|preview|track|region|range|volume|mute|solo|pan|fade|bpm|tempo|loop|wav/,
  /재생|플레이|틀어|시작|이어|멈춰|멈추|일시\s*정지|정지|스탑/,
  /이동|옮겨|위치|초\s*(로|부터|까지)|구간|미리\s*(듣|들)|들려/,
  /내보내|다운로드|저장|추출|익스포트|웨이브|파일/,
  /트랙|리전|영역|볼륨|음량|소리|뮤트|솔로|팬|패닝/,
  /페이드|템포|박자|루프|반복|자르|나누|분할|크기|길이/,
] as const;
const PLAN_REVIEW_MESSAGE_PATTERNS = [
  /ready\s+for\s+review/,
  /prepared\s+(a\s+)?command\s+plan/,
  /검토/,
  /실행\s*계획/,
  /명령.*준비/,
] as const;

export class AgentChatWorkflow {
  private readonly responder: IAgentResponder;
  private readonly planWorkflow: AgentWorkflow;
  private readonly getSessionState: () => AgentSessionSummarySource;
  private readonly createPlanId: () => string;

  constructor({
    createPlanId = createDefaultPlanId,
    getSessionState,
    planWorkflow,
    responder,
  }: AgentChatWorkflowDependencies) {
    this.createPlanId = createPlanId;
    this.getSessionState = getSessionState;
    this.planWorkflow = planWorkflow;
    this.responder = responder;
  }

  async sendMessage({
    messages,
    requestText,
  }: SendAgentMessageInput): Promise<SendAgentMessageResult> {
    const normalizedRequestText = requestText.trim();
    const sessionSummary = createAgentSessionSummary(this.getSessionState());
    const responseResult = await this.requestResponse({
      messages,
      requestText: normalizedRequestText,
      sessionSummary,
    });

    if (!responseResult.ok) {
      return { errors: [responseResult.error], ok: false };
    }

    const draft = responseResult.draft;
    const messageResult = validateAssistantMessage(draft.message);

    if (!messageResult.ok) {
      return { errors: [messageResult.error], ok: false };
    }

    const stepsResult = validateResponseSteps(draft.steps);

    if (!stepsResult.ok) {
      return {
        errors: [
          {
            code: 'INVALID_AGENT_RESPONSE',
            message: stepsResult.message,
          },
        ],
        ok: false,
      };
    }

    const shouldUseCommandSteps =
      hasExplicitCommandIntent(normalizedRequestText) &&
      stepsResult.steps.length > 0;

    if (!shouldUseCommandSteps) {
      return {
        assistantMessage: createNonCommandAssistantMessage({
          message: messageResult.message,
          requestText: normalizedRequestText,
        }),
        ok: true,
        plan: null,
      };
    }

    const validationResult = validateAgentPlanDraft({
      draft: { steps: stepsResult.steps },
      planId: this.createPlanId(),
      requestText: normalizedRequestText,
      revision: 1,
      sessionSummaryFingerprint:
        createAgentSessionSummaryFingerprint(sessionSummary),
    });

    if (!validationResult.ok) {
      return { errors: validationResult.errors, ok: false };
    }

    return {
      assistantMessage: messageResult.message,
      ok: true,
      plan: validationResult.plan,
    };
  }

  rejectPlan(input: RejectAgentPlanInput): AgentCommandPlan {
    return this.planWorkflow.rejectPlan(input);
  }

  async approvePlan(
    input: ApproveAgentPlanInput
  ): Promise<ApproveAgentPlanResult> {
    return await this.planWorkflow.approvePlan(input);
  }

  private async requestResponse({
    messages,
    requestText,
    sessionSummary,
  }: {
    messages: readonly AgentChatMessage[];
    requestText: string;
    sessionSummary: AgentSessionSummary;
  }): Promise<
    | { ok: true; draft: AgentResponseDraft }
    | { ok: false; error: AgentResponseFailure }
  > {
    try {
      const draft = await this.responder.createResponse({
        commandCatalog: agentCommandCatalog,
        messages,
        requestText,
        sessionSummary,
      });

      return { draft, ok: true };
    } catch {
      return {
        error: {
          code: 'AGENT_RESPONSE_FAILED',
          message: 'Agent failed to create a chat response.',
        },
        ok: false,
      };
    }
  }
}

export function createPlannerBackedAgentResponder(
  planner: IAgentPlanner
): IAgentResponder {
  return new PlannerBackedAgentResponder(planner);
}

export function isAgentResponder(value: unknown): value is IAgentResponder {
  return (
    typeof value === 'object' &&
    value !== null &&
    'createResponse' in value &&
    typeof (value as { createResponse?: unknown }).createResponse === 'function'
  );
}

class PlannerBackedAgentResponder implements IAgentResponder {
  private readonly planner: IAgentPlanner;

  constructor(planner: IAgentPlanner) {
    this.planner = planner;
  }

  async createResponse(input: AgentResponseInput): Promise<AgentResponseDraft> {
    const draft = await this.planner.createPlan(toPlanningInput(input));

    return {
      message: createPlannerBackedMessage(draft),
      steps: draft.steps,
    };
  }
}

function toPlanningInput(input: AgentResponseInput): AgentPlanningInput {
  return {
    commandCatalog: input.commandCatalog,
    requestText: input.requestText,
    sessionSummary: input.sessionSummary,
  };
}

function createPlannerBackedMessage(draft: AgentPlanDraft): string {
  if (Array.isArray(draft.steps) && draft.steps.length > 0) {
    return 'I prepared a command plan for review.';
  }

  return 'I can answer questions about this session, or prepare a command plan when you ask for a concrete DAW action.';
}

function validateResponseSteps(
  steps: unknown
): { ok: true; steps: unknown[] } | { ok: false; message: string } {
  if (!Array.isArray(steps)) {
    return {
      message: 'Agent response steps must be an array.',
      ok: false,
    };
  }

  return { ok: true, steps };
}

function hasExplicitCommandIntent(requestText: string): boolean {
  const normalizedRequestText = requestText.trim().toLowerCase();

  if (normalizedRequestText.length === 0) {
    return false;
  }

  return COMMAND_INTENT_PATTERNS.some((pattern) =>
    pattern.test(normalizedRequestText)
  );
}

function createNonCommandAssistantMessage({
  message,
  requestText,
}: {
  message: string;
  requestText: string;
}): string {
  if (!isPlanReviewMessage(message)) {
    return message;
  }

  return createClarificationMessage(requestText);
}

function isPlanReviewMessage(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase();

  return PLAN_REVIEW_MESSAGE_PATTERNS.some((pattern) =>
    pattern.test(normalizedMessage)
  );
}

function createClarificationMessage(requestText: string): string {
  if (KOREAN_TEXT_PATTERN.test(requestText)) {
    return '입력 내용을 이해하지 못했어요. 재생, 정지, 내보내기처럼 원하는 작업이나 궁금한 점을 조금 더 구체적으로 말해 주세요.';
  }

  return 'I could not understand that message. Please ask a question or describe a specific DAW action such as play, stop, or export.';
}

function validateAssistantMessage(
  message: string
):
  | { ok: true; message: string }
  | { ok: false; error: InvalidAgentResponseError } {
  const normalizedMessage = message.trim();

  if (normalizedMessage.length === 0) {
    return {
      error: {
        code: 'INVALID_AGENT_RESPONSE',
        message: 'Agent response message must be a non-empty string.',
      },
      ok: false,
    };
  }

  return { message: normalizedMessage, ok: true };
}

function createDefaultPlanId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

import { commandSchema } from '@/controllers';
import type {
  AgentCommandPlan,
  AgentCommandPlanStep,
  AgentPlanDraft,
} from './agent-plan';

export type AgentPlanValidationErrorCode =
  | 'INVALID_AGENT_PLAN'
  | 'INVALID_AGENT_PLAN_STEP'
  | 'INVALID_AGENT_COMMAND';

export interface AgentPlanValidationError {
  code: AgentPlanValidationErrorCode;
  message: string;
  stepIndex?: number;
  cause?: unknown;
}

export interface ValidateAgentPlanDraftInput {
  draft: AgentPlanDraft;
  planId: string;
  requestText: string;
  revision: number;
  sessionSummaryFingerprint: string;
}

export type AgentPlanValidationResult =
  | {
      ok: true;
      plan: AgentCommandPlan;
    }
  | {
      ok: false;
      errors: AgentPlanValidationError[];
    };

export interface ValidateAgentPlanExecutionReadinessInput {
  plan: AgentCommandPlan;
  currentSessionSummaryFingerprint: string;
}

export type AgentPlanExecutionReadinessResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      code: 'AGENT_PLAN_NOT_DRAFT' | 'STALE_AGENT_PLAN';
      message: string;
    };

export function validateAgentPlanDraft({
  draft,
  planId,
  requestText,
  revision,
  sessionSummaryFingerprint,
}: ValidateAgentPlanDraftInput): AgentPlanValidationResult {
  if (!Array.isArray(draft.steps) || draft.steps.length === 0) {
    return {
      errors: [
        {
          code: 'INVALID_AGENT_PLAN',
          message: 'Agent plan must include at least one step.',
        },
      ],
      ok: false,
    };
  }

  const errors: AgentPlanValidationError[] = [];
  const steps: AgentCommandPlanStep[] = [];

  draft.steps.forEach((step, stepIndex) => {
    const stepResult = validateAgentPlanStep(step, stepIndex);

    if (!stepResult.ok) {
      errors.push(stepResult.error);
      return;
    }

    steps.push(stepResult.step);
  });

  if (errors.length > 0) {
    return { errors, ok: false };
  }

  return {
    ok: true,
    plan: {
      id: planId,
      requestText,
      revision,
      sessionSummaryFingerprint,
      status: 'draft',
      steps,
    },
  };
}

export function validateAgentPlanExecutionReadiness({
  currentSessionSummaryFingerprint,
  plan,
}: ValidateAgentPlanExecutionReadinessInput): AgentPlanExecutionReadinessResult {
  if (plan.status !== 'draft') {
    return {
      code: 'AGENT_PLAN_NOT_DRAFT',
      message: 'Only draft agent plans can be approved for execution.',
      ok: false,
    };
  }

  if (plan.sessionSummaryFingerprint !== currentSessionSummaryFingerprint) {
    return {
      code: 'STALE_AGENT_PLAN',
      message:
        'The session changed after this plan was created. Create a new plan before executing commands.',
      ok: false,
    };
  }

  return { ok: true };
}

function validateAgentPlanStep(
  step: unknown,
  stepIndex: number
):
  | { ok: true; step: AgentCommandPlanStep }
  | { ok: false; error: AgentPlanValidationError } {
  if (!isRecord(step)) {
    return {
      error: {
        code: 'INVALID_AGENT_PLAN_STEP',
        message: `Agent plan step ${stepIndex + 1} must be an object.`,
        stepIndex,
      },
      ok: false,
    };
  }

  const id = step.id;
  const reason = step.reason;

  if (typeof id !== 'string' || id.length === 0) {
    return {
      error: {
        code: 'INVALID_AGENT_PLAN_STEP',
        message: `Agent plan step ${stepIndex + 1} requires a non-empty id.`,
        stepIndex,
      },
      ok: false,
    };
  }

  if (typeof reason !== 'string' || reason.length === 0) {
    return {
      error: {
        code: 'INVALID_AGENT_PLAN_STEP',
        message: `Agent plan step ${stepIndex + 1} requires a non-empty reason.`,
        stepIndex,
      },
      ok: false,
    };
  }

  const commandResult = commandSchema.safeParse(step.command);

  if (!commandResult.success) {
    return {
      error: {
        cause: commandResult.error.issues,
        code: 'INVALID_AGENT_COMMAND',
        message: `Agent plan step ${stepIndex + 1} contains an invalid command.`,
        stepIndex,
      },
      ok: false,
    };
  }

  return {
    ok: true,
    step: {
      command: commandResult.data,
      id,
      reason,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

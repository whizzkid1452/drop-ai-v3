import type { AppCommand, CommandError, CommandResult } from '@/controllers';
import {
  agentCommandCatalog,
  type AgentCommandDefinition,
} from './agent-command-catalog';
import {
  AgentAuditLog,
  summarizeCommandResultForAudit,
  type AgentAuditEntry,
} from './agent-audit-log';
import type { AgentCommandPlan, AgentPlanDraft } from './agent-plan';
import {
  validateAgentPlanDraft,
  validateAgentPlanExecutionReadiness,
  type AgentPlanValidationError,
} from './agent-plan-validator';
import {
  createAgentSessionSummary,
  createAgentSessionSummaryFingerprint,
  type AgentSessionSummary,
  type AgentSessionSummarySource,
} from './agent-session-summary';

export interface AgentPlanningInput {
  requestText: string;
  commandCatalog: readonly AgentCommandDefinition[];
  sessionSummary: AgentSessionSummary;
}

export interface IAgentPlanner {
  createPlan(input: AgentPlanningInput): Promise<AgentPlanDraft>;
}

export interface AgentWorkflowCommandExecutor {
  executeCommand(command: AppCommand): Promise<CommandResult>;
}

export interface AgentWorkflowDependencies {
  planner: IAgentPlanner;
  commandExecutor: AgentWorkflowCommandExecutor;
  getSessionState: () => AgentSessionSummarySource;
  auditLog?: AgentAuditLog;
  createPlanId?: () => string;
}

export interface RequestAgentPlanInput {
  requestText: string;
}

export type RequestAgentPlanResult =
  | {
      ok: true;
      plan: AgentCommandPlan;
      auditEntries: AgentAuditEntry[];
    }
  | {
      ok: false;
      errors: RequestAgentPlanError[];
      auditEntries: AgentAuditEntry[];
    };

export type RequestAgentPlanError =
  | AgentPlanValidationError
  | AgentPlannerFailure;

export interface AgentPlannerFailure {
  code: 'AGENT_PLANNER_FAILED';
  message: string;
}

export interface RejectAgentPlanInput {
  plan: AgentCommandPlan;
}

export interface ApproveAgentPlanInput {
  plan: AgentCommandPlan;
}

export type ApproveAgentPlanResult =
  | {
      ok: true;
      plan: AgentCommandPlan;
      results: CommandResult[];
      auditEntries: AgentAuditEntry[];
    }
  | {
      ok: false;
      plan: AgentCommandPlan;
      error: CommandError | AgentWorkflowExecutionError;
      results: CommandResult[];
      auditEntries: AgentAuditEntry[];
    };

export interface AgentWorkflowExecutionError {
  code: 'AGENT_PLAN_NOT_DRAFT' | 'STALE_AGENT_PLAN';
  message: string;
}

export class AgentWorkflow {
  private readonly planner: IAgentPlanner;
  private readonly commandExecutor: AgentWorkflowCommandExecutor;
  private readonly getSessionState: () => AgentSessionSummarySource;
  private readonly auditLog: AgentAuditLog;
  private readonly createPlanId: () => string;

  constructor({
    auditLog = new AgentAuditLog(),
    commandExecutor,
    createPlanId = createDefaultPlanId,
    getSessionState,
    planner,
  }: AgentWorkflowDependencies) {
    this.auditLog = auditLog;
    this.commandExecutor = commandExecutor;
    this.createPlanId = createPlanId;
    this.getSessionState = getSessionState;
    this.planner = planner;
  }

  async requestPlan({
    requestText,
  }: RequestAgentPlanInput): Promise<RequestAgentPlanResult> {
    const planId = this.createPlanId();
    const sessionSummary = createAgentSessionSummary(this.getSessionState());
    const sessionSummaryFingerprint =
      createAgentSessionSummaryFingerprint(sessionSummary);

    this.auditLog.record({
      details: { requestText },
      event: 'plan_requested',
      planId,
    });

    const draftResult = await this.requestDraftPlan({
      planId,
      requestText,
      sessionSummary,
    });

    if (!draftResult.ok) {
      return {
        auditEntries: this.auditLog.getEntries(),
        errors: [draftResult.error],
        ok: false,
      };
    }

    const validationResult = validateAgentPlanDraft({
      draft: draftResult.draft,
      planId,
      requestText,
      revision: 1,
      sessionSummaryFingerprint,
    });

    if (!validationResult.ok) {
      this.auditLog.record({
        details: { errors: validationResult.errors },
        event: 'plan_validation_failed',
        planId,
      });

      return {
        auditEntries: this.auditLog.getEntries(),
        errors: validationResult.errors,
        ok: false,
      };
    }

    this.auditLog.record({
      details: { stepCount: validationResult.plan.steps.length },
      event: 'plan_created',
      planId,
    });

    return {
      auditEntries: this.auditLog.getEntries(),
      ok: true,
      plan: validationResult.plan,
    };
  }

  rejectPlan({ plan }: RejectAgentPlanInput): AgentCommandPlan {
    const rejectedPlan: AgentCommandPlan = {
      ...plan,
      status: 'rejected',
    };

    this.auditLog.record({
      details: { revision: plan.revision },
      event: 'plan_rejected',
      planId: plan.id,
    });

    return rejectedPlan;
  }

  async approvePlan({
    plan,
  }: ApproveAgentPlanInput): Promise<ApproveAgentPlanResult> {
    const sessionSummary = createAgentSessionSummary(this.getSessionState());
    const readiness = validateAgentPlanExecutionReadiness({
      currentSessionSummaryFingerprint:
        createAgentSessionSummaryFingerprint(sessionSummary),
      plan,
    });

    if (!readiness.ok) {
      const failedPlan = updatePlanStatus(plan, 'failed');

      this.auditLog.record({
        details: {
          code: readiness.code,
          message: readiness.message,
        },
        event: 'plan_failed',
        planId: plan.id,
      });

      return {
        auditEntries: this.auditLog.getEntries(),
        error: {
          code: readiness.code,
          message: readiness.message,
        },
        ok: false,
        plan: failedPlan,
        results: [],
      };
    }

    this.auditLog.record({
      details: { revision: plan.revision },
      event: 'plan_approved',
      planId: plan.id,
    });

    return await this.executeApprovedPlan(updatePlanStatus(plan, 'executing'));
  }

  private async executeApprovedPlan(
    plan: AgentCommandPlan
  ): Promise<ApproveAgentPlanResult> {
    const results: CommandResult[] = [];

    for (const step of plan.steps) {
      this.auditLog.record({
        details: { commandType: step.command.type, stepId: step.id },
        event: 'command_started',
        planId: plan.id,
      });

      const result = await this.commandExecutor.executeCommand(step.command);
      results.push(result);

      if (!result.ok) {
        this.auditLog.record({
          details: summarizeCommandResultForAudit(result),
          event: 'command_failed',
          planId: plan.id,
        });
        this.auditLog.record({
          details: { failedStepId: step.id },
          event: 'plan_failed',
          planId: plan.id,
        });

        return {
          auditEntries: this.auditLog.getEntries(),
          error: result.error,
          ok: false,
          plan: updatePlanStatus(plan, 'failed'),
          results,
        };
      }

      this.auditLog.record({
        details: summarizeCommandResultForAudit(result),
        event: 'command_succeeded',
        planId: plan.id,
      });
    }

    this.auditLog.record({
      details: { executedStepCount: results.length },
      event: 'plan_completed',
      planId: plan.id,
    });

    return {
      auditEntries: this.auditLog.getEntries(),
      ok: true,
      plan: updatePlanStatus(plan, 'completed'),
      results,
    };
  }

  private async requestDraftPlan({
    planId,
    requestText,
    sessionSummary,
  }: {
    planId: string;
    requestText: string;
    sessionSummary: AgentSessionSummary;
  }): Promise<
    | { ok: true; draft: AgentPlanDraft }
    | { ok: false; error: AgentPlannerFailure }
  > {
    try {
      const draft = await this.planner.createPlan({
        commandCatalog: agentCommandCatalog,
        requestText,
        sessionSummary,
      });

      return { draft, ok: true };
    } catch {
      const error: AgentPlannerFailure = {
        code: 'AGENT_PLANNER_FAILED',
        message: 'Agent planner failed to create a command plan.',
      };

      this.auditLog.record({
        details: error,
        event: 'plan_failed',
        planId,
      });

      return { error, ok: false };
    }
  }
}

function updatePlanStatus(
  plan: AgentCommandPlan,
  status: AgentCommandPlan['status']
): AgentCommandPlan {
  return { ...plan, status };
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

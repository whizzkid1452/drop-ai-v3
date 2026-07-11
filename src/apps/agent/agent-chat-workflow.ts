import type {
  AgentWorkflow,
  ApproveAgentPlanResult,
  RequestAgentPlanResult,
} from './agent-workflow';
import type { AgentAuditEntry } from './agent-audit-log';
import type { AgentCommandPlan } from './agent-plan';
import type { CommandResult } from '@/controllers';

export interface AgentChatWorkflowDependencies {
  agentWorkflow: Pick<AgentWorkflow, 'approvePlan' | 'requestPlan'>;
}

export interface SubmitAgentChatInput {
  requestText: string;
}

export type SubmitAgentChatResult =
  | {
      auditEntries: AgentAuditEntry[];
      message: string;
      ok: true;
      plan: AgentCommandPlan;
      results: CommandResult[];
    }
  | {
      auditEntries: AgentAuditEntry[];
      message: string;
      ok: false;
      plan: AgentCommandPlan | null;
      results: CommandResult[];
    };

export class AgentChatWorkflow {
  private readonly agentWorkflow: Pick<
    AgentWorkflow,
    'approvePlan' | 'requestPlan'
  >;

  constructor({ agentWorkflow }: AgentChatWorkflowDependencies) {
    this.agentWorkflow = agentWorkflow;
  }

  async submit({
    requestText,
  }: SubmitAgentChatInput): Promise<SubmitAgentChatResult> {
    const normalizedRequestText = requestText.trim();

    if (!normalizedRequestText) {
      return {
        auditEntries: [],
        message: 'Enter a request before running commands.',
        ok: false,
        plan: null,
        results: [],
      };
    }

    const requestResult = await this.agentWorkflow.requestPlan({
      requestText: normalizedRequestText,
    });

    if (!requestResult.ok) {
      return createPlanRequestFailureResult(requestResult);
    }

    const approvalResult = await this.agentWorkflow.approvePlan({
      plan: requestResult.plan,
    });

    return createPlanApprovalResult(approvalResult);
  }
}

function createPlanRequestFailureResult(
  result: Extract<RequestAgentPlanResult, { ok: false }>
): SubmitAgentChatResult {
  return {
    auditEntries: result.auditEntries,
    message: result.errors.map((error) => error.message).join('\n'),
    ok: false,
    plan: null,
    results: [],
  };
}

function createPlanApprovalResult(
  result: ApproveAgentPlanResult
): SubmitAgentChatResult {
  if (!result.ok) {
    return {
      auditEntries: result.auditEntries,
      message: result.error.message,
      ok: false,
      plan: result.plan,
      results: result.results,
    };
  }

  return {
    auditEntries: result.auditEntries,
    message: formatCompletedMessage(result.results.length),
    ok: true,
    plan: result.plan,
    results: result.results,
  };
}

function formatCompletedMessage(commandCount: number): string {
  return `Completed ${commandCount} ${commandCount === 1 ? 'command' : 'commands'}.`;
}

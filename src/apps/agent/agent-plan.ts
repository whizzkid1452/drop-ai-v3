import type { AppCommand } from '@/controllers';

export type AgentCommandPlanStatus =
  | 'draft'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rejected';

export interface AgentCommandPlanStep {
  id: string;
  command: AppCommand;
  reason: string;
}

export interface AgentCommandPlan {
  id: string;
  revision: number;
  requestText: string;
  sessionSummaryFingerprint: string;
  steps: AgentCommandPlanStep[];
  status: AgentCommandPlanStatus;
}

export interface AgentPlanDraft {
  steps: unknown;
}

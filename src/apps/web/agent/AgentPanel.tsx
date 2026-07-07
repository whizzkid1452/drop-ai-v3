import { useState } from 'react';
import type {
  ApproveAgentPlanResult,
  RequestAgentPlanResult,
} from '@/apps/agent/agent-workflow';
import type { AgentCommandPlan } from '@/apps/agent/agent-plan';
import type { CommandResult, SessionExportResult } from '@/controllers';
import { useAgentWorkflow } from '../AppProvider';
import * as styles from '../App.css';

type AgentPendingAction = 'request' | 'approve' | 'reject';

export function AgentPanel() {
  const agentWorkflow = useAgentWorkflow();
  const [requestText, setRequestText] = useState('');
  const [plan, setPlan] = useState<AgentCommandPlan | null>(null);
  const [pendingAction, setPendingAction] = useState<AgentPendingAction | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  async function requestPlan(): Promise<void> {
    const normalizedRequestText = requestText.trim();
    if (!normalizedRequestText) {
      setErrorMessage('Enter a request before creating a plan.');
      return;
    }

    setPendingAction('request');
    setErrorMessage(null);
    setExecutionMessage(null);
    setPlan(null);

    const result = await agentWorkflow.requestPlan({
      requestText: normalizedRequestText,
    });

    setPendingAction(null);
    applyPlanRequestResult(result);
  }

  function rejectPlan(): void {
    if (!plan) {
      return;
    }

    setPendingAction('reject');
    const rejectedPlan = agentWorkflow.rejectPlan({ plan });
    setPlan(rejectedPlan);
    setExecutionMessage('Plan rejected.');
    setErrorMessage(null);
    setPendingAction(null);
  }

  async function approvePlan(): Promise<void> {
    if (!plan) {
      return;
    }

    setPendingAction('approve');
    setErrorMessage(null);
    setExecutionMessage(null);

    const result = await agentWorkflow.approvePlan({ plan });

    setPendingAction(null);
    applyPlanApprovalResult(result);
  }

  function applyPlanRequestResult(result: RequestAgentPlanResult): void {
    if (!result.ok) {
      setErrorMessage(result.errors.map((error) => error.message).join('\n'));
      return;
    }

    setPlan(result.plan);
  }

  function applyPlanApprovalResult(result: ApproveAgentPlanResult): void {
    setPlan(result.plan);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    const downloadMessage = downloadExportResults(result.results);
    const commandCount = result.results.length;
    const completedMessage = `Completed ${commandCount} ${commandCount === 1 ? 'command' : 'commands'}.`;

    setExecutionMessage(
      downloadMessage
        ? `${completedMessage} ${downloadMessage}`
        : completedMessage
    );
  }

  const hasDraftPlan = plan?.status === 'draft';

  return (
    <section className={styles.agentPanel} aria-label="Agent command planner">
      <div className={styles.agentHeader}>
        <h2 className={styles.sectionTitle}>Agent</h2>
        {plan ? (
          <p className={styles.agentStatus} data-testid="agent-plan-status">
            {formatPlanStatus(plan.status)}
          </p>
        ) : null}
      </div>
      <form
        className={styles.agentForm}
        onSubmit={(event) => {
          event.preventDefault();
          void requestPlan();
        }}
      >
        <label className={styles.agentInputLabel}>
          <span className={styles.summaryLabel}>Request</span>
          <textarea
            aria-label="Agent request"
            className={styles.agentTextarea}
            data-testid="agent-request-input"
            rows={3}
            value={requestText}
            onChange={(event) => setRequestText(event.currentTarget.value)}
          />
        </label>
        <button
          className={styles.primaryButton}
          data-testid="agent-request-plan"
          disabled={pendingAction !== null}
          type="button"
          onClick={() => void requestPlan()}
        >
          Plan
        </button>
      </form>
      {plan ? <AgentPlanPreview plan={plan} /> : null}
      {hasDraftPlan ? (
        <div className={styles.agentActionRow}>
          <button
            className={styles.primaryButton}
            data-testid="agent-approve-plan"
            disabled={pendingAction !== null}
            type="button"
            onClick={() => void approvePlan()}
          >
            Approve
          </button>
          <button
            className={styles.secondaryButton}
            data-testid="agent-reject-plan"
            disabled={pendingAction !== null}
            type="button"
            onClick={rejectPlan}
          >
            Reject
          </button>
        </div>
      ) : null}
      {executionMessage ? (
        <p
          className={styles.commandMessage}
          data-testid="agent-execution-message"
        >
          {executionMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className={styles.transportError} data-testid="agent-error">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

function AgentPlanPreview({ plan }: { plan: AgentCommandPlan }) {
  return (
    <ol className={styles.agentStepList} data-testid="agent-plan-steps">
      {plan.steps.map((step) => (
        <li className={styles.agentStep} key={step.id}>
          <div className={styles.agentStepHeader}>
            <strong
              className={styles.agentStepCommand}
              data-testid="agent-plan-step-command"
            >
              {step.command.type}
            </strong>
            <span className={styles.summaryLabel}>{step.id}</span>
          </div>
          <p className={styles.agentReason}>{step.reason}</p>
          {hasPayload(step.command) ? (
            <pre className={styles.agentPayload}>
              {JSON.stringify(step.command.payload, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function formatPlanStatus(status: AgentCommandPlan['status']): string {
  switch (status) {
    case 'approved':
      return 'Approved plan';
    case 'completed':
      return 'Completed plan';
    case 'draft':
      return 'Draft plan';
    case 'executing':
      return 'Executing plan';
    case 'failed':
      return 'Failed plan';
    case 'rejected':
      return 'Rejected plan';
  }
}

function hasPayload(
  command: AgentCommandPlan['steps'][number]['command']
): command is AgentCommandPlan['steps'][number]['command'] & {
  payload: unknown;
} {
  return 'payload' in command;
}

function downloadExportResults(results: CommandResult[]): string | null {
  const exports = results
    .map((result) => getSessionExportResult(result))
    .filter((result): result is SessionExportResult => result !== null);

  for (const result of exports) {
    downloadSessionExportResult(result);
  }

  if (exports.length === 0) {
    return null;
  }

  if (exports.length === 1) {
    return `Download started: ${exports[0].filename}.`;
  }

  return `Downloads started: ${exports.length}.`;
}

function getSessionExportResult(
  result: CommandResult
): SessionExportResult | null {
  if (!result.ok) {
    return null;
  }

  if (
    result.command.type !== 'session.export' &&
    result.command.type !== 'session.exportRange.export'
  ) {
    return null;
  }

  if (!isSessionExportResult(result.data)) {
    return null;
  }

  return result.data;
}

function downloadSessionExportResult(result: SessionExportResult): void {
  const objectUrl = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');

  try {
    anchor.href = objectUrl;
    anchor.download = result.filename;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

function isSessionExportResult(value: unknown): value is SessionExportResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'blob' in value &&
    value.blob instanceof Blob &&
    'filename' in value &&
    typeof value.filename === 'string'
  );
}

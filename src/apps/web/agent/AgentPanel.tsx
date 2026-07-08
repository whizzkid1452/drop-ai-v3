import { useState, type KeyboardEvent } from 'react';
import type { AgentChatMessage } from '@/apps/agent/agent-chat';
import type { AgentCommandPlan } from '@/apps/agent/agent-plan';
import type { ApproveAgentPlanResult } from '@/apps/agent/agent-workflow';
import type { CommandResult, SessionExportResult } from '@/controllers';
import {
  useAgentChatWorkflow,
  useAgentPlannerProgress,
  useClearAgentPlannerProgress,
  type AgentPlannerProgress,
} from '../AppProvider';
import * as styles from '../App.css';

type AgentPendingAction = 'approve' | 'reject' | 'send';

interface AgentPanelMessage extends AgentChatMessage {
  id: string;
}

export function AgentPanel() {
  const agentChatWorkflow = useAgentChatWorkflow();
  const agentPlannerProgress = useAgentPlannerProgress();
  const clearAgentPlannerProgress = useClearAgentPlannerProgress();
  const [requestText, setRequestText] = useState('');
  const [messages, setMessages] = useState<AgentPanelMessage[]>([]);
  const [plan, setPlan] = useState<AgentCommandPlan | null>(null);
  const [pendingAction, setPendingAction] = useState<AgentPendingAction | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  async function sendMessage(requestTextOverride = requestText): Promise<void> {
    const normalizedRequestText = requestTextOverride.trim();
    if (!normalizedRequestText) {
      setErrorMessage('Enter a message before sending.');
      return;
    }

    const conversationMessages = messages.map(toAgentChatMessage);
    const userMessage = createPanelMessage({
      content: normalizedRequestText,
      role: 'user',
    });
    const assistantMessage = createPanelMessage({
      content: 'Thinking...',
      role: 'assistant',
    });

    setPendingAction('send');
    setErrorMessage(null);
    setExecutionMessage(null);
    setPlan(null);
    setRequestText('');
    setMessages((previousMessages) => [
      ...previousMessages,
      userMessage,
      assistantMessage,
    ]);

    if (agentPlannerProgress?.status !== 'loading') {
      clearAgentPlannerProgress();
    }

    try {
      const result = await agentChatWorkflow.sendMessage({
        messages: [...conversationMessages, toAgentChatMessage(userMessage)],
        requestText: normalizedRequestText,
      });

      if (!result.ok) {
        const errorText = result.errors
          .map((error) => error.message)
          .join('\n');

        updateMessageContent(assistantMessage.id, errorText);
        setErrorMessage(errorText);
        return;
      }

      updateMessageContent(assistantMessage.id, result.assistantMessage);
      setPlan(result.plan);
    } catch {
      const errorText = 'Agent failed to create a chat response.';
      updateMessageContent(assistantMessage.id, errorText);
      setErrorMessage(errorText);
    } finally {
      setPendingAction(null);
    }
  }

  function handleRequestTextKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ): void {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();

    if (pendingAction !== null) {
      return;
    }

    void sendMessage(event.currentTarget.value);
  }

  function rejectPlan(): void {
    if (!plan) {
      return;
    }

    setPendingAction('reject');
    const rejectedPlan = agentChatWorkflow.rejectPlan({ plan });
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

    const result = await agentChatWorkflow.approvePlan({ plan });

    setPendingAction(null);
    applyPlanApprovalResult(result);
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

  function updateMessageContent(messageId: string, content: string): void {
    setMessages((previousMessages) =>
      previousMessages.map((message) =>
        message.id === messageId ? { ...message, content } : message
      )
    );
  }

  const hasDraftPlan = plan?.status === 'draft';
  const shouldShowPlannerProgress = agentPlannerProgress !== null;

  return (
    <section className={styles.agentPanel} aria-label="Agent chat">
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
          void sendMessage();
        }}
      >
        <AgentMessageList messages={messages} />
        <label className={styles.agentInputLabel}>
          <span className={styles.summaryLabel}>Message</span>
          <textarea
            aria-label="Agent message"
            className={styles.agentTextarea}
            data-testid="agent-request-input"
            rows={3}
            value={requestText}
            onChange={(event) => setRequestText(event.currentTarget.value)}
            onKeyDown={handleRequestTextKeyDown}
          />
        </label>
        <button
          className={styles.primaryButton}
          data-testid="agent-request-plan"
          disabled={pendingAction !== null}
          type="button"
          onClick={() => void sendMessage()}
        >
          Send
        </button>
      </form>
      {shouldShowPlannerProgress ? (
        <AgentPlannerProgressView progress={agentPlannerProgress} />
      ) : null}
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

function AgentMessageList({ messages }: { messages: AgentPanelMessage[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ol className={styles.agentMessageList} data-testid="agent-messages">
      {messages.map((message) => (
        <li
          className={`${styles.agentMessage} ${
            message.role === 'user'
              ? styles.agentMessageUser
              : styles.agentMessageAssistant
          }`}
          key={message.id}
        >
          <span className={styles.agentMessageRole}>{message.role}</span>
          <p
            className={styles.agentMessageContent}
            data-testid="agent-message-content"
          >
            {message.content}
          </p>
        </li>
      ))}
    </ol>
  );
}

function AgentPlannerProgressView({
  progress,
}: {
  progress: AgentPlannerProgress;
}) {
  return (
    <div
      className={styles.agentPlannerProgress}
      data-testid="agent-planner-progress"
    >
      <div className={styles.agentPlannerProgressHeader}>
        <span data-testid="agent-planner-progress-status">
          {formatAgentPlannerProgressStatus(progress.status)}
        </span>
        <span data-testid="agent-planner-progress-percent">
          {progress.progressPercent}%
        </span>
      </div>
      <div
        aria-label="Model loading progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress.progressPercent}
        className={styles.agentPlannerProgressTrack}
        role="progressbar"
      >
        <span
          className={styles.agentPlannerProgressFill}
          style={{ width: `${progress.progressPercent}%` }}
        />
      </div>
      <p
        className={styles.agentPlannerProgressMessage}
        data-testid="agent-planner-progress-message"
      >
        {progress.message}
      </p>
    </div>
  );
}

function formatAgentPlannerProgressStatus(
  status: AgentPlannerProgress['status']
): string {
  switch (status) {
    case 'failed':
      return 'Model load failed';
    case 'loading':
      return 'Model loading';
    case 'ready':
      return 'Model ready';
  }
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

function createPanelMessage({
  content,
  role,
}: AgentChatMessage): AgentPanelMessage {
  return {
    content,
    id: createMessageId(),
    role,
  };
}

function toAgentChatMessage(message: AgentPanelMessage): AgentChatMessage {
  return {
    content: message.content,
    role: message.role,
  };
}

function createMessageId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

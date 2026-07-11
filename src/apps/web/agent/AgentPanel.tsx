import { useRef, useState } from 'react';
import type { SubmitAgentChatResult } from '@/apps/agent/agent-chat-workflow';
import type { CommandResult } from '@/controllers';
import { useAgentChatWorkflow } from '../AppProvider';
import { downloadSessionExportResult } from '../cli/session-export-download';
import * as styles from '../App.css';

type AgentPendingAction = 'submit';
type AgentMessageRole = 'assistant' | 'user';
type AgentMessageTone = 'error' | 'neutral' | 'success';

interface AgentChatMessage {
  id: string;
  role: AgentMessageRole;
  text: string;
  tone: AgentMessageTone;
}

export function AgentPanel() {
  const agentChatWorkflow = useAgentChatWorkflow();
  const [requestText, setRequestText] = useState('');
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      id: 'agent-message-initial',
      role: 'assistant',
      text: 'Ready.',
      tone: 'neutral',
    },
  ]);
  const [pendingAction, setPendingAction] = useState<AgentPendingAction | null>(
    null
  );
  const nextMessageIdRef = useRef(0);

  async function submitRequest(): Promise<void> {
    const normalizedRequestText = requestText.trim();
    if (!normalizedRequestText || pendingAction !== null) {
      return;
    }

    const userMessage = createMessage({
      createId: createNextMessageId,
      role: 'user',
      text: normalizedRequestText,
      tone: 'neutral',
    });

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setRequestText('');
    setPendingAction('submit');

    try {
      const result = await agentChatWorkflow.submit({
        requestText: normalizedRequestText,
      });
      const assistantMessage = createAssistantMessage({
        createId: createNextMessageId,
        result,
      });

      setMessages((currentMessages) => [...currentMessages, assistantMessage]);
    } catch {
      const assistantMessage = createMessage({
        createId: createNextMessageId,
        role: 'assistant',
        text: 'Agent planner failed to run commands.',
        tone: 'error',
      });

      setMessages((currentMessages) => [...currentMessages, assistantMessage]);
    } finally {
      setPendingAction(null);
    }
  }

  function createNextMessageId(): string {
    nextMessageIdRef.current += 1;
    return `agent-message-${nextMessageIdRef.current}`;
  }

  const isPending = pendingAction !== null;

  return (
    <section className={styles.agentPanel} aria-label="Agent chat">
      <div className={styles.agentHeader}>
        <h2 className={styles.sectionTitle}>Chat</h2>
        <p className={styles.agentStatus} data-testid="agent-status">
          {isPending ? 'Running' : 'Ready'}
        </p>
      </div>
      <ol className={styles.agentMessageList} data-testid="agent-messages">
        {messages.map((message) => (
          <li
            className={`${styles.agentMessage} ${message.role === 'user' ? styles.agentMessageUser : styles.agentMessageAssistant}`}
            data-message-tone={message.tone}
            data-testid="agent-message"
            key={message.id}
          >
            <p className={styles.agentMessageText}>{message.text}</p>
          </li>
        ))}
      </ol>
      <form
        className={styles.agentForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submitRequest();
        }}
      >
        <label className={styles.agentInputLabel}>
          <span className={styles.summaryLabel}>Request</span>
          <textarea
            aria-label="Agent request"
            className={styles.agentTextarea}
            data-testid="agent-request-input"
            disabled={isPending}
            rows={3}
            value={requestText}
            onChange={(event) => setRequestText(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) {
                return;
              }

              event.preventDefault();
              void submitRequest();
            }}
          />
        </label>
        <button
          className={styles.primaryButton}
          data-testid="agent-submit-request"
          disabled={isPending || requestText.trim().length === 0}
          type="submit"
        >
          Run
        </button>
      </form>
    </section>
  );
}

function createAssistantMessage({
  createId,
  result,
}: {
  createId: () => string;
  result: SubmitAgentChatResult;
}): AgentChatMessage {
  const downloadMessage = downloadExportResults(result.results);
  const message = downloadMessage
    ? `${result.message} ${downloadMessage}`
    : result.message;

  return createMessage({
    createId,
    role: 'assistant',
    text: message,
    tone: result.ok ? 'success' : 'error',
  });
}

function createMessage({
  createId,
  role,
  text,
  tone,
}: {
  createId: () => string;
  role: AgentMessageRole;
  text: string;
  tone: AgentMessageTone;
}): AgentChatMessage {
  return {
    id: createId(),
    role,
    text,
    tone,
  };
}

function downloadExportResults(results: CommandResult[]): string | null {
  const downloadedResults = results.filter((result) =>
    downloadSessionExportResult(result)
  );

  if (downloadedResults.length === 0) {
    return null;
  }

  if (downloadedResults.length === 1) {
    return 'Download started.';
  }

  return `Downloads started: ${downloadedResults.length}.`;
}

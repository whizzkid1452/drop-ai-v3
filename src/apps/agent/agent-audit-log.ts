import type { CommandResult, SessionExportResult } from '@/controllers';

export type AgentAuditEvent =
  | 'plan_requested'
  | 'plan_created'
  | 'plan_validation_failed'
  | 'plan_approved'
  | 'plan_rejected'
  | 'command_started'
  | 'command_succeeded'
  | 'command_failed'
  | 'plan_completed'
  | 'plan_failed';

export interface AgentAuditEntry {
  id: string;
  planId: string;
  event: AgentAuditEvent;
  timestamp: number;
  details: unknown;
}

export interface AgentAuditRecordInput {
  planId: string;
  event: AgentAuditEvent;
  details: unknown;
}

export interface AgentAuditLogDependencies {
  createId?: () => string;
  now?: () => number;
}

export type CommandResultAuditSummary =
  | {
      ok: true;
      commandType: string;
      data?: unknown;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

export class AgentAuditLog {
  private readonly createId: () => string;
  private readonly now: () => number;
  private readonly entries: AgentAuditEntry[] = [];

  constructor({
    createId = createDefaultAuditId,
    now = () => Date.now(),
  }: AgentAuditLogDependencies = {}) {
    this.createId = createId;
    this.now = now;
  }

  record({ details, event, planId }: AgentAuditRecordInput): AgentAuditEntry {
    const entry = {
      details: sanitizeAuditValue(details),
      event,
      id: this.createId(),
      planId,
      timestamp: this.now(),
    };

    this.entries.push(entry);
    return { ...entry };
  }

  getEntries(): AgentAuditEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }
}

export function summarizeCommandResultForAudit(
  result: CommandResult
): CommandResultAuditSummary {
  if (!result.ok) {
    return {
      error: {
        code: result.error.code,
        message: result.error.message,
      },
      ok: false,
    };
  }

  const summary: CommandResultAuditSummary = {
    commandType: result.command.type,
    ok: true,
  };

  const data = summarizeCommandData(result.data);

  if (data !== undefined) {
    return { ...summary, data };
  }

  return summary;
}

function summarizeCommandData(data: unknown): unknown {
  if (isSessionExportResult(data)) {
    return {
      filename: data.filename,
      size: data.blob.size,
    };
  }

  return sanitizeAuditValue(data);
}

function sanitizeAuditValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (isFile(value)) {
    return {
      kind: 'File',
      name: value.name,
      size: value.size,
      type: value.type,
    };
  }

  if (value instanceof Blob) {
    return {
      kind: 'Blob',
      size: value.size,
      type: value.type,
    };
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAuditValue(entry));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sanitizeAuditValue(entry),
      ])
    );
  }

  return value;
}

function isSessionExportResult(value: unknown): value is SessionExportResult {
  return (
    isRecord(value) &&
    value.blob instanceof Blob &&
    typeof value.filename === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

function createDefaultAuditId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

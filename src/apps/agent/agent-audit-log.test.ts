import { describe, expect, it } from 'vitest';
import type { CommandResult } from '@/controllers';
import {
  AgentAuditLog,
  summarizeCommandResultForAudit,
} from './agent-audit-log';

describe('AgentAuditLog', () => {
  it('records immutable entries in append order', () => {
    let nextId = 0;
    const auditLog = new AgentAuditLog({
      createId: () => `audit-${(nextId += 1)}`,
      now: () => 1000 + nextId,
    });

    auditLog.record({
      details: { requestText: '1초부터 3초까지만 들려줘.' },
      event: 'plan_requested',
      planId: 'plan-1',
    });
    auditLog.record({
      details: { stepCount: 2 },
      event: 'plan_created',
      planId: 'plan-1',
    });

    const entries = auditLog.getEntries();

    expect(entries).toEqual([
      {
        details: { requestText: '1초부터 3초까지만 들려줘.' },
        event: 'plan_requested',
        id: 'audit-1',
        planId: 'plan-1',
        timestamp: 1001,
      },
      {
        details: { stepCount: 2 },
        event: 'plan_created',
        id: 'audit-2',
        planId: 'plan-1',
        timestamp: 1002,
      },
    ]);

    entries.pop();
    expect(auditLog.getEntries()).toHaveLength(2);
  });
});

describe('summarizeCommandResultForAudit', () => {
  it('stores export result metadata instead of the Blob itself', () => {
    const blob = new Blob(['audio']);
    const result: CommandResult = {
      command: {
        type: 'session.exportRange.export',
        payload: { filename: 'clip.wav' },
      },
      data: {
        blob,
        filename: 'clip.wav',
      },
      ok: true,
    };

    expect(summarizeCommandResultForAudit(result)).toEqual({
      commandType: 'session.exportRange.export',
      data: {
        filename: 'clip.wav',
        size: 5,
      },
      ok: true,
    });
  });

  it('stores error code and message without the original cause', () => {
    const result: CommandResult = {
      error: {
        cause: new Error('internal detail'),
        code: 'COMMAND_EXECUTION_FAILED',
        message: 'Cannot export an empty range.',
      },
      ok: false,
    };

    expect(summarizeCommandResultForAudit(result)).toEqual({
      error: {
        code: 'COMMAND_EXECUTION_FAILED',
        message: 'Cannot export an empty range.',
      },
      ok: false,
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  validateAgentPlanDraft,
  validateAgentPlanExecutionReadiness,
} from './agent-plan-validator';

describe('validateAgentPlanDraft', () => {
  it('returns a draft plan with validated AppCommand steps', () => {
    const result = validateAgentPlanDraft({
      draft: {
        steps: [
          {
            command: {
              type: 'session.exportRange.start.set',
              payload: { seconds: 1 },
            },
            id: 'step-1',
            reason: 'Set the start of the requested preview range.',
          },
          {
            command: {
              type: 'session.exportRange.end.set',
              payload: { seconds: 3 },
            },
            id: 'step-2',
            reason: 'Set the end of the requested preview range.',
          },
        ],
      },
      planId: 'plan-1',
      requestText: '1초부터 3초까지만 들려줘.',
      revision: 1,
      sessionSummaryFingerprint: 'fingerprint-1',
    });

    expect(result).toEqual({
      ok: true,
      plan: {
        id: 'plan-1',
        requestText: '1초부터 3초까지만 들려줘.',
        revision: 1,
        sessionSummaryFingerprint: 'fingerprint-1',
        status: 'draft',
        steps: [
          {
            command: {
              type: 'session.exportRange.start.set',
              payload: { seconds: 1 },
            },
            id: 'step-1',
            reason: 'Set the start of the requested preview range.',
          },
          {
            command: {
              type: 'session.exportRange.end.set',
              payload: { seconds: 3 },
            },
            id: 'step-2',
            reason: 'Set the end of the requested preview range.',
          },
        ],
      },
    });
  });

  it('rejects an unknown command type before preview', () => {
    const result = validateAgentPlanDraft({
      draft: {
        steps: [
          {
            command: { type: 'unknown.command' },
            id: 'step-1',
            reason: 'Invalid command.',
          },
        ],
      },
      planId: 'plan-1',
      requestText: 'invalid',
      revision: 1,
      sessionSummaryFingerprint: 'fingerprint-1',
    });

    expect(result).toMatchObject({
      errors: [
        {
          code: 'INVALID_AGENT_COMMAND',
          message:
            'Agent plan step 1 contains an invalid command (command type "unknown.command": type: unsupported command type).',
          stepIndex: 0,
        },
      ],
      ok: false,
    });
  });

  it('rejects an invalid command payload before preview', () => {
    const result = validateAgentPlanDraft({
      draft: {
        steps: [
          {
            command: {
              type: 'session.exportRange.start.set',
              payload: { seconds: -1 },
            },
            id: 'step-1',
            reason: 'Negative seconds are invalid.',
          },
        ],
      },
      planId: 'plan-1',
      requestText: 'invalid',
      revision: 1,
      sessionSummaryFingerprint: 'fingerprint-1',
    });

    expect(result).toMatchObject({
      errors: [
        {
          code: 'INVALID_AGENT_COMMAND',
          message:
            'Agent plan step 1 contains an invalid command (command type "session.exportRange.start.set": payload.seconds: Too small: expected number to be >=0).',
          stepIndex: 0,
        },
      ],
      ok: false,
    });
  });
});

describe('validateAgentPlanExecutionReadiness', () => {
  it('blocks execution when the session fingerprint changed after planning', () => {
    const result = validateAgentPlanExecutionReadiness({
      currentSessionSummaryFingerprint: 'fingerprint-2',
      plan: {
        id: 'plan-1',
        requestText: '1초부터 3초까지만 들려줘.',
        revision: 1,
        sessionSummaryFingerprint: 'fingerprint-1',
        status: 'draft',
        steps: [
          {
            command: {
              type: 'session.exportRange.start.set',
              payload: { seconds: 1 },
            },
            id: 'step-1',
            reason: 'Set range start.',
          },
        ],
      },
    });

    expect(result).toEqual({
      code: 'STALE_AGENT_PLAN',
      message:
        'The session changed after this plan was created. Create a new plan before executing commands.',
      ok: false,
    });
  });
});

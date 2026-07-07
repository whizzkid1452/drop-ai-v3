import { describe, expect, it } from 'vitest';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createApp } from '@/composition/create-app';
import type { AppCommand, CommandResult } from '@/controllers';
import { createCallRecorder } from '@/testing/call-recorder';
import { createTestIdGenerator } from '@/testing/id-generator';
import { AgentAuditLog } from './agent-audit-log';
import { AgentWorkflow, type IAgentPlanner } from './agent-workflow';
import { ScriptedAgentPlanner } from './scripted-agent-planner';

describe('AgentWorkflow', () => {
  it('creates a draft plan without executing commands', async () => {
    const executor = createRecordingExecutor();
    const workflow = createWorkflow({
      commandExecutor: executor,
      planner: new ScriptedAgentPlanner({
        scripts: {
          preview: {
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
        },
      }),
    });

    const result = await workflow.requestPlan({ requestText: 'preview' });

    expect(result).toMatchObject({
      ok: true,
      plan: {
        requestText: 'preview',
        status: 'draft',
        steps: [
          {
            command: {
              type: 'session.exportRange.start.set',
              payload: { seconds: 1 },
            },
            id: 'step-1',
          },
        ],
      },
    });
    expect(executor.commands).toEqual([]);
  });

  it('returns a planning failure when the planner rejects', async () => {
    const executor = createRecordingExecutor();
    const workflow = createWorkflow({
      commandExecutor: executor,
      planner: createRejectingPlanner(),
    });

    const result = await workflow.requestPlan({ requestText: 'preview' });

    expect(result).toMatchObject({
      errors: [
        {
          code: 'AGENT_PLANNER_FAILED',
          message: 'Agent planner failed to create a command plan.',
        },
      ],
      ok: false,
    });
    expect(result.auditEntries.map((entry) => entry.event)).toEqual([
      'plan_requested',
      'plan_failed',
    ]);
    expect(executor.commands).toEqual([]);
  });

  it('rejects a plan without executing commands', async () => {
    const executor = createRecordingExecutor();
    const workflow = createWorkflow({
      commandExecutor: executor,
      planner: new ScriptedAgentPlanner({
        scripts: {
          preview: {
            steps: [
              {
                command: { type: 'playback.play' },
                id: 'step-1',
                reason: 'Start playback.',
              },
            ],
          },
        },
      }),
    });

    const requestResult = await workflow.requestPlan({
      requestText: 'preview',
    });
    if (!requestResult.ok) {
      throw new Error('Expected plan request to succeed.');
    }

    const rejectedPlan = workflow.rejectPlan({ plan: requestResult.plan });

    expect(rejectedPlan.status).toBe('rejected');
    expect(executor.commands).toEqual([]);
  });

  it('executes approved commands in order', async () => {
    const executor = createRecordingExecutor();
    const workflow = createWorkflow({
      commandExecutor: executor,
      planner: new ScriptedAgentPlanner({
        scripts: {
          preview: {
            steps: [
              {
                command: {
                  type: 'session.exportRange.start.set',
                  payload: { seconds: 1 },
                },
                id: 'step-1',
                reason: 'Set range start.',
              },
              {
                command: {
                  type: 'session.exportRange.end.set',
                  payload: { seconds: 3 },
                },
                id: 'step-2',
                reason: 'Set range end.',
              },
            ],
          },
        },
      }),
    });

    const requestResult = await workflow.requestPlan({
      requestText: 'preview',
    });
    if (!requestResult.ok) {
      throw new Error('Expected plan request to succeed.');
    }

    const executionResult = await workflow.approvePlan({
      plan: requestResult.plan,
    });

    expect(executionResult.ok).toBe(true);
    expect(executionResult.plan.status).toBe('completed');
    expect(executor.commands.map((command) => command.type)).toEqual([
      'session.exportRange.start.set',
      'session.exportRange.end.set',
    ]);
  });

  it('stops execution after the first failed command', async () => {
    const executor = createRecordingExecutor({
      failCommandType: 'session.exportRange.start.set',
    });
    const workflow = createWorkflow({
      commandExecutor: executor,
      planner: new ScriptedAgentPlanner({
        scripts: {
          preview: {
            steps: [
              {
                command: {
                  type: 'session.exportRange.start.set',
                  payload: { seconds: 1 },
                },
                id: 'step-1',
                reason: 'Set range start.',
              },
              {
                command: {
                  type: 'session.exportRange.end.set',
                  payload: { seconds: 3 },
                },
                id: 'step-2',
                reason: 'Set range end.',
              },
            ],
          },
        },
      }),
    });

    const requestResult = await workflow.requestPlan({
      requestText: 'preview',
    });
    if (!requestResult.ok) {
      throw new Error('Expected plan request to succeed.');
    }

    const executionResult = await workflow.approvePlan({
      plan: requestResult.plan,
    });

    expect(executionResult).toMatchObject({
      error: {
        code: 'COMMAND_EXECUTION_FAILED',
        message: 'failed by test',
      },
      ok: false,
      plan: {
        status: 'failed',
      },
    });
    expect(executor.commands.map((command) => command.type)).toEqual([
      'session.exportRange.start.set',
    ]);
  });

  it('blocks stale plan execution', async () => {
    const sessionState = createSessionSummarySource();
    const workflow = createWorkflow({
      getSessionState: () => sessionState,
      planner: new ScriptedAgentPlanner({
        scripts: {
          preview: {
            steps: [
              {
                command: { type: 'playback.play' },
                id: 'step-1',
                reason: 'Start playback.',
              },
            ],
          },
        },
      }),
    });

    const requestResult = await workflow.requestPlan({
      requestText: 'preview',
    });
    if (!requestResult.ok) {
      throw new Error('Expected plan request to succeed.');
    }

    sessionState.playback.positionSeconds = 2;

    const executionResult = await workflow.approvePlan({
      plan: requestResult.plan,
    });

    expect(executionResult).toMatchObject({
      error: {
        code: 'STALE_AGENT_PLAN',
      },
      ok: false,
      plan: {
        status: 'failed',
      },
    });
  });

  it('runs through AppController in an in-memory app integration path', async () => {
    const recorder = createCallRecorder();
    const app = createApp({
      audioEngine: new FakeAudioEngine({ recorder }),
      idGenerator: createTestIdGenerator(),
      sessionId: 'session-1',
    });
    const workflow = new AgentWorkflow({
      auditLog: createAuditLog(),
      commandExecutor: app.controller,
      getSessionState: () => app.sessionReader.getState(),
      planner: new ScriptedAgentPlanner({
        scripts: {
          play: {
            steps: [
              {
                command: {
                  type: 'playback.seek',
                  payload: { seconds: 2 },
                },
                id: 'step-1',
                reason: 'Move to the requested time.',
              },
              {
                command: { type: 'playback.play' },
                id: 'step-2',
                reason: 'Start playback.',
              },
            ],
          },
        },
      }),
    });

    const requestResult = await workflow.requestPlan({ requestText: 'play' });
    if (!requestResult.ok) {
      throw new Error('Expected plan request to succeed.');
    }

    const executionResult = await workflow.approvePlan({
      plan: requestResult.plan,
    });

    expect(executionResult.ok).toBe(true);
    expect(app.sessionReader.getState().playback).toMatchObject({
      playing: true,
      positionSeconds: 2,
    });
    expect(recorder.getCalls('seek')[0].args).toEqual([2]);
    expect(recorder.getCalls('play')).toHaveLength(1);
  });
});

function createWorkflow(
  overrides: Partial<ConstructorParameters<typeof AgentWorkflow>[0]> = {}
): AgentWorkflow {
  return new AgentWorkflow({
    auditLog: createAuditLog(),
    commandExecutor: createRecordingExecutor(),
    getSessionState: createSessionSummarySource,
    planner: new ScriptedAgentPlanner({ scripts: {} }),
    ...overrides,
  });
}

function createAuditLog(): AgentAuditLog {
  let auditId = 0;
  return new AgentAuditLog({
    createId: () => `audit-${(auditId += 1)}`,
    now: () => auditId,
  });
}

function createRejectingPlanner(): IAgentPlanner {
  return {
    async createPlan() {
      throw new Error('provider unavailable');
    },
  };
}

function createRecordingExecutor(input: { failCommandType?: string } = {}) {
  const commands: AppCommand[] = [];

  return {
    commands,
    async executeCommand(command: AppCommand) {
      commands.push(command);

      if (command.type === input.failCommandType) {
        return {
          error: {
            code: 'COMMAND_EXECUTION_FAILED',
            message: 'failed by test',
          },
          ok: false,
        } satisfies CommandResult;
      }

      return {
        command,
        data: undefined,
        ok: true,
      } satisfies CommandResult;
    },
  };
}

function createSessionSummarySource() {
  return {
    exportRange: {
      endSeconds: 4,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      startSeconds: 0,
    },
    id: 'session-1',
    playback: {
      bpm: 120,
      loop: {
        enabled: false,
        end: 4,
        start: 0,
      },
      masterVolume: 1,
      playing: false,
      positionSeconds: 0,
    },
    trackOrder: [],
    tracksById: {},
  };
}

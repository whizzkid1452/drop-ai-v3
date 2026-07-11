import { describe, expect, it } from 'vitest';
import type { AppCommand, CommandResult } from '@/controllers';
import { AgentAuditLog } from './agent-audit-log';
import { AgentChatWorkflow } from './agent-chat-workflow';
import { AgentWorkflow, type IAgentPlanner } from './agent-workflow';
import { ScriptedAgentPlanner } from './scripted-agent-planner';

describe('AgentChatWorkflow', () => {
  it('creates and executes a validated command plan in one submit flow', async () => {
    const executor = createRecordingExecutor();
    const chatWorkflow = createChatWorkflow({
      commandExecutor: executor,
      planner: new ScriptedAgentPlanner({
        scripts: {
          'set range': {
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

    const result = await chatWorkflow.submit({ requestText: 'set range' });

    expect(result).toMatchObject({
      message: 'Completed 2 commands.',
      ok: true,
      plan: {
        status: 'completed',
      },
    });
    expect(executor.commands.map((command) => command.type)).toEqual([
      'session.exportRange.start.set',
      'session.exportRange.end.set',
    ]);
  });

  it('returns validation failure without executing commands', async () => {
    const executor = createRecordingExecutor();
    const chatWorkflow = createChatWorkflow({
      commandExecutor: executor,
      planner: new ScriptedAgentPlanner({ scripts: {} }),
    });

    const result = await chatWorkflow.submit({ requestText: 'unknown' });

    expect(result).toMatchObject({
      message: 'Agent plan must include at least one step.',
      ok: false,
      plan: null,
      results: [],
    });
    expect(executor.commands).toEqual([]);
  });

  it('returns command failure after the first failed command', async () => {
    const executor = createRecordingExecutor({
      failCommandType: 'session.exportRange.start.set',
    });
    const chatWorkflow = createChatWorkflow({
      commandExecutor: executor,
      planner: new ScriptedAgentPlanner({
        scripts: {
          'set range': {
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

    const result = await chatWorkflow.submit({ requestText: 'set range' });

    expect(result).toMatchObject({
      message: 'failed by test',
      ok: false,
      plan: {
        status: 'failed',
      },
    });
    expect(executor.commands.map((command) => command.type)).toEqual([
      'session.exportRange.start.set',
    ]);
  });

  it('rejects blank requests before planning', async () => {
    const executor = createRecordingExecutor();
    const planner = createRejectingPlanner();
    const chatWorkflow = createChatWorkflow({
      commandExecutor: executor,
      planner,
    });

    const result = await chatWorkflow.submit({ requestText: '   ' });

    expect(result).toMatchObject({
      message: 'Enter a request before running commands.',
      ok: false,
      plan: null,
      results: [],
    });
    expect(executor.commands).toEqual([]);
  });
});

function createChatWorkflow({
  commandExecutor,
  planner,
}: {
  commandExecutor: ReturnType<typeof createRecordingExecutor>;
  planner: IAgentPlanner;
}): AgentChatWorkflow {
  return new AgentChatWorkflow({
    agentWorkflow: new AgentWorkflow({
      auditLog: createAuditLog(),
      commandExecutor,
      getSessionState: createSessionSummarySource,
      planner,
    }),
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

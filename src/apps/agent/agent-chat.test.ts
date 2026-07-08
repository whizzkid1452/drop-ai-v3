import { describe, expect, it } from 'vitest';
import { FakeAudioEngine } from '@/audio-engine/fake-audio-engine';
import { createApp } from '@/composition/create-app';
import { createTestIdGenerator } from '@/testing/id-generator';
import { AgentChatWorkflow, type IAgentResponder } from './agent-chat';
import { AgentWorkflow } from './agent-workflow';
import { ScriptedAgentPlanner } from './scripted-agent-planner';

describe('AgentChatWorkflow', () => {
  it('returns an assistant message without requiring command steps', async () => {
    const workflow = createWorkflow({
      responder: createResponder({
        message: '현재 세션에는 트랙이 없습니다.',
        steps: [],
      }),
    });

    const result = await workflow.sendMessage({
      messages: [{ content: '현재 상태 알려줘', role: 'user' }],
      requestText: '현재 상태 알려줘',
    });

    expect(result).toEqual({
      assistantMessage: '현재 세션에는 트랙이 없습니다.',
      ok: true,
      plan: null,
    });
  });

  it('validates command steps into a draft plan when the response includes executable actions', async () => {
    const workflow = createWorkflow({
      responder: createResponder({
        message: '재생 명령을 검토할 수 있게 준비했습니다.',
        steps: [
          {
            command: { type: 'playback.play' },
            id: 'step-1',
            reason: 'Start playback.',
          },
        ],
      }),
    });

    const result = await workflow.sendMessage({
      messages: [{ content: '재생해줘', role: 'user' }],
      requestText: '재생해줘',
    });

    expect(result).toMatchObject({
      assistantMessage: '재생 명령을 검토할 수 있게 준비했습니다.',
      ok: true,
      plan: {
        status: 'draft',
        steps: [
          {
            command: { type: 'playback.play' },
            id: 'step-1',
          },
        ],
      },
    });
  });

  it('drops command steps when the user message has no explicit DAW action intent', async () => {
    const workflow = createWorkflow({
      responder: createResponder({
        message: 'Ready for review',
        steps: [
          {
            command: { type: 'playback.play' },
            id: 'step-1',
            reason: 'Start playback.',
          },
        ],
      }),
    });

    const result = await workflow.sendMessage({
      messages: [{ content: 'ㅇㅇㅇ', role: 'user' }],
      requestText: 'ㅇㅇㅇ',
    });

    expect(result).toEqual({
      assistantMessage:
        '입력 내용을 이해하지 못했어요. 재생, 정지, 내보내기처럼 원하는 작업이나 궁금한 점을 조금 더 구체적으로 말해 주세요.',
      ok: true,
      plan: null,
    });
  });

  it('keeps a non-command assistant answer without promoting stray command steps', async () => {
    const workflow = createWorkflow({
      responder: createResponder({
        message: '현재 세션에는 트랙이 없습니다.',
        steps: [
          {
            command: { type: 'playback.play' },
            id: 'step-1',
            reason: 'Start playback.',
          },
        ],
      }),
    });

    const result = await workflow.sendMessage({
      messages: [{ content: '현재 상태 알려줘', role: 'user' }],
      requestText: '현재 상태 알려줘',
    });

    expect(result).toEqual({
      assistantMessage: '현재 세션에는 트랙이 없습니다.',
      ok: true,
      plan: null,
    });
  });

  it('rejects malformed response steps before command approval', async () => {
    const workflow = createWorkflow({
      responder: createResponder({
        message: '응답은 있지만 steps 형식이 잘못되었습니다.',
        steps: 'play',
      }),
    });

    const result = await workflow.sendMessage({
      messages: [{ content: '재생해줘', role: 'user' }],
      requestText: '재생해줘',
    });

    expect(result).toEqual({
      errors: [
        {
          code: 'INVALID_AGENT_RESPONSE',
          message: 'Agent response steps must be an array.',
        },
      ],
      ok: false,
    });
  });
});

function createWorkflow(input: { responder: IAgentResponder }) {
  const app = createApp({
    audioEngine: new FakeAudioEngine(),
    idGenerator: createTestIdGenerator(),
    sessionId: 'session-1',
  });
  const planWorkflow = new AgentWorkflow({
    commandExecutor: app.controller,
    getSessionState: () => app.sessionReader.getState(),
    planner: new ScriptedAgentPlanner({ scripts: {} }),
  });

  return new AgentChatWorkflow({
    getSessionState: () => app.sessionReader.getState(),
    planWorkflow,
    responder: input.responder,
  });
}

function createResponder(response: {
  message: string;
  steps: unknown;
}): IAgentResponder {
  return {
    async createResponse() {
      return response;
    },
  };
}

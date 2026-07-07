import type { AgentPlanDraft } from '@/apps/agent/agent-plan';
import type {
  AgentPlanningInput,
  IAgentPlanner,
} from '@/apps/agent/agent-workflow';
import { ScriptedAgentPlanner } from '@/apps/agent/scripted-agent-planner';

const DEFAULT_AGENT_PLAN_SCRIPTS: Record<string, AgentPlanDraft> = {
  'export range': {
    steps: [
      {
        command: {
          type: 'session.exportRange.export',
          payload: { filename: 'range.wav' },
        },
        id: 'step-1',
        reason: 'Export the current range.',
      },
    ],
  },
  'export session': {
    steps: [
      {
        command: {
          type: 'session.export',
          payload: { filename: 'session.wav' },
        },
        id: 'step-1',
        reason: 'Export the full session.',
      },
    ],
  },
  pause: {
    steps: [
      {
        command: { type: 'playback.pause' },
        id: 'step-1',
        reason: 'Pause playback.',
      },
    ],
  },
  play: {
    steps: [
      {
        command: { type: 'playback.play' },
        id: 'step-1',
        reason: 'Start playback.',
      },
    ],
  },
  'preview range': {
    steps: [
      {
        command: { type: 'session.exportRange.preview.play' },
        id: 'step-1',
        reason: 'Preview the current export range.',
      },
    ],
  },
  stop: {
    steps: [
      {
        command: { type: 'playback.stop' },
        id: 'step-1',
        reason: 'Stop playback.',
      },
    ],
  },
  '구간 내보내기': {
    steps: [
      {
        command: {
          type: 'session.exportRange.export',
          payload: { filename: 'range.wav' },
        },
        id: 'step-1',
        reason: 'Export the current range.',
      },
    ],
  },
  '구간 미리듣기': {
    steps: [
      {
        command: { type: 'session.exportRange.preview.play' },
        id: 'step-1',
        reason: 'Preview the current export range.',
      },
    ],
  },
  일시정지: {
    steps: [
      {
        command: { type: 'playback.pause' },
        id: 'step-1',
        reason: 'Pause playback.',
      },
    ],
  },
  재생: {
    steps: [
      {
        command: { type: 'playback.play' },
        id: 'step-1',
        reason: 'Start playback.',
      },
    ],
  },
  정지: {
    steps: [
      {
        command: { type: 'playback.stop' },
        id: 'step-1',
        reason: 'Stop playback.',
      },
    ],
  },
  '전체 내보내기': {
    steps: [
      {
        command: {
          type: 'session.export',
          payload: { filename: 'session.wav' },
        },
        id: 'step-1',
        reason: 'Export the full session.',
      },
    ],
  },
};

export function createDefaultAgentPlanner(): IAgentPlanner {
  return new NormalizedScriptedAgentPlanner({
    scripts: DEFAULT_AGENT_PLAN_SCRIPTS,
  });
}

class NormalizedScriptedAgentPlanner implements IAgentPlanner {
  private readonly planner: ScriptedAgentPlanner;

  constructor(input: { scripts: Record<string, AgentPlanDraft> }) {
    this.planner = new ScriptedAgentPlanner(input);
  }

  async createPlan(input: AgentPlanningInput): Promise<AgentPlanDraft> {
    return await this.planner.createPlan({
      ...input,
      requestText: input.requestText.trim().toLowerCase(),
    });
  }
}

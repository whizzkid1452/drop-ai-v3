import type { AgentPlanDraft } from '@/apps/agent/agent-plan';
import type {
  AgentPlanningInput,
  IAgentPlanner,
} from '@/apps/agent/agent-workflow';
import { HttpAgentPlanner } from '@/apps/agent/planner-adapters/http-agent-planner';
import {
  WebLLMAgentPlanner,
  type WebLLMInitProgressCallback,
} from '@/apps/agent/planner-adapters/webllm-agent-planner';
import { ScriptedAgentPlanner } from '@/apps/agent/scripted-agent-planner';

type AgentPlannerProvider = 'http' | 'scripted' | 'webllm';

interface AgentPlannerEnvironment {
  VITE_AGENT_PLANNER_ENDPOINT?: string;
  VITE_AGENT_PLANNER_PROVIDER?: string;
  VITE_AGENT_WEBLLM_MODEL_ID?: string;
}

export interface CreateDefaultAgentPlannerInput {
  environment?: AgentPlannerEnvironment;
  webLLMInitProgressCallback?: WebLLMInitProgressCallback;
}

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

export function createDefaultAgentPlanner({
  environment = import.meta.env,
  webLLMInitProgressCallback,
}: CreateDefaultAgentPlannerInput = {}): IAgentPlanner {
  const provider = parseAgentPlannerProvider(
    environment.VITE_AGENT_PLANNER_PROVIDER
  );

  switch (provider) {
    case 'http':
      return createHttpAgentPlanner(environment);
    case 'scripted':
      return createScriptedAgentPlanner();
    case 'webllm':
      return createWebLLMAgentPlanner({
        environment,
        webLLMInitProgressCallback,
      });
  }
}

function createScriptedAgentPlanner(): IAgentPlanner {
  return new NormalizedScriptedAgentPlanner({
    scripts: DEFAULT_AGENT_PLAN_SCRIPTS,
  });
}

function createHttpAgentPlanner(
  environment: AgentPlannerEnvironment
): IAgentPlanner {
  const endpoint = trimEnvironmentValue(
    environment.VITE_AGENT_PLANNER_ENDPOINT
  );

  if (!endpoint) {
    throw new Error(
      'VITE_AGENT_PLANNER_ENDPOINT is required when VITE_AGENT_PLANNER_PROVIDER is "http".'
    );
  }

  return new HttpAgentPlanner({ endpoint });
}

function createWebLLMAgentPlanner({
  environment,
  webLLMInitProgressCallback,
}: {
  environment: AgentPlannerEnvironment;
  webLLMInitProgressCallback: CreateDefaultAgentPlannerInput['webLLMInitProgressCallback'];
}): IAgentPlanner {
  const modelId = trimEnvironmentValue(environment.VITE_AGENT_WEBLLM_MODEL_ID);

  return new WebLLMAgentPlanner({
    ...(modelId ? { modelId } : {}),
    initProgressCallback: webLLMInitProgressCallback,
  });
}

function parseAgentPlannerProvider(
  value: string | undefined
): AgentPlannerProvider {
  const normalizedValue = trimEnvironmentValue(value).toLowerCase();

  if (!normalizedValue) {
    return 'webllm';
  }

  if (
    normalizedValue === 'http' ||
    normalizedValue === 'scripted' ||
    normalizedValue === 'webllm'
  ) {
    return normalizedValue;
  }

  throw new Error(`Unsupported agent planner provider: ${normalizedValue}.`);
}

function trimEnvironmentValue(value: string | undefined): string {
  return value?.trim() ?? '';
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

import type { AgentPlanDraft } from './agent-plan';
import type { AgentPlanningInput, IAgentPlanner } from './agent-workflow';

export interface ScriptedAgentPlannerDependencies {
  scripts: Record<string, AgentPlanDraft>;
}

export class ScriptedAgentPlanner implements IAgentPlanner {
  private readonly scripts: Record<string, AgentPlanDraft>;

  constructor({ scripts }: ScriptedAgentPlannerDependencies) {
    this.scripts = scripts;
  }

  async createPlan(input: AgentPlanningInput): Promise<AgentPlanDraft> {
    return cloneDraft(this.scripts[input.requestText] ?? { steps: [] });
  }
}

function cloneDraft(draft: AgentPlanDraft): AgentPlanDraft {
  if (!Array.isArray(draft.steps)) {
    return { steps: draft.steps };
  }

  return {
    steps: draft.steps.map((step) => cloneJsonLikeValue(step)),
  };
}

function cloneJsonLikeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJsonLikeValue(entry));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        cloneJsonLikeValue(entry),
      ])
    );
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

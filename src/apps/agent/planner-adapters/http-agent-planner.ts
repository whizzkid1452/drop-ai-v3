import type { AgentPlanDraft } from '../agent-plan';
import type { AgentPlanningInput, IAgentPlanner } from '../agent-workflow';
import {
  createAgentPlannerCommandDefinitions,
  type AgentPlannerCommandDefinition,
} from './agent-planner-command-definition';

const DEFAULT_TIMEOUT_MS = 10_000;

export type AgentPlannerFetch = (
  input: string,
  init: RequestInit
) => Promise<Response>;

export interface HttpAgentPlannerDependencies {
  endpoint: string;
  fetch?: AgentPlannerFetch;
  timeoutMs?: number;
}

export interface HttpAgentPlannerRequestBody {
  requestText: string;
  sessionSummary: AgentPlanningInput['sessionSummary'];
  commandCatalog: HttpAgentPlannerCommandDefinition[];
}

export type HttpAgentPlannerCommandDefinition = AgentPlannerCommandDefinition;

export class HttpAgentPlanner implements IAgentPlanner {
  private readonly endpoint: string;
  private readonly fetch: AgentPlannerFetch;
  private readonly timeoutMs: number;

  constructor({
    endpoint,
    fetch = globalThis.fetch.bind(globalThis),
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: HttpAgentPlannerDependencies) {
    this.endpoint = endpoint;
    this.fetch = fetch;
    this.timeoutMs = timeoutMs;
  }

  async createPlan(input: AgentPlanningInput): Promise<AgentPlanDraft> {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetch(this.endpoint, {
        body: JSON.stringify(createRequestBody(input)),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Agent planner request failed with HTTP ${response.status}.`
        );
      }

      return parsePlanDraftResponse(await readJsonResponse(response));
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error('Agent planner request timed out.', { cause: error });
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function createRequestBody(
  input: AgentPlanningInput
): HttpAgentPlannerRequestBody {
  return {
    commandCatalog: createAgentPlannerCommandDefinitions(input.commandCatalog),
    requestText: input.requestText,
    sessionSummary: input.sessionSummary,
  };
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Agent planner response must be valid JSON.');
  }
}

function parsePlanDraftResponse(value: unknown): AgentPlanDraft {
  if (!isRecord(value) || !('steps' in value)) {
    throw new Error('Agent planner response must include a steps field.');
  }

  return { steps: value.steps };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

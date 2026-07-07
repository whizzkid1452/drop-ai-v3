import type {
  AgentCommandAvailability,
  AgentCommandDefinition,
} from '../agent-command-catalog';

export interface AgentPlannerCommandDefinition {
  type: string;
  title: string;
  description: string;
  payloadDescription: string;
  availability: AgentCommandAvailability;
  examples: unknown[];
}

export function createAgentPlannerCommandDefinitions(
  commandCatalog: readonly AgentCommandDefinition[]
): AgentPlannerCommandDefinition[] {
  return commandCatalog.map(toAgentPlannerCommandDefinition);
}

function toAgentPlannerCommandDefinition(
  definition: AgentCommandDefinition
): AgentPlannerCommandDefinition {
  return {
    availability: definition.availability,
    description: definition.description,
    examples:
      definition.availability === 'agent' ? [...definition.examples] : [],
    payloadDescription: definition.payloadDescription,
    title: definition.title,
    type: definition.type,
  };
}

import { describe, expect, it } from 'vitest';
import { commandSchema } from '@/controllers';
import {
  agentCommandCatalog,
  getAgentCommandDefinition,
} from './agent-command-catalog';

describe('agentCommandCatalog', () => {
  it('exposes validated examples for commands available to the agent', () => {
    const availableDefinitions = agentCommandCatalog.filter(
      (definition) => definition.availability === 'agent'
    );

    expect(availableDefinitions.length).toBeGreaterThan(0);

    for (const definition of availableDefinitions) {
      expect(definition.examples.length).toBeGreaterThan(0);

      for (const example of definition.examples) {
        expect(example.type).toBe(definition.type);
        expect(commandSchema.safeParse(example).success).toBe(true);
      }
    }
  });

  it('marks asset registration as requiring a user attachment', () => {
    const definition = getAgentCommandDefinition('asset.register');

    expect(definition).toMatchObject({
      availability: 'requiresUserAttachment',
      type: 'asset.register',
    });
    expect(definition.examples).toEqual([]);
  });

  it('does not define duplicated command types', () => {
    const commandTypes = agentCommandCatalog.map(
      (definition) => definition.type
    );
    const uniqueCommandTypes = new Set(commandTypes);

    expect(uniqueCommandTypes.size).toBe(commandTypes.length);
  });
});

export interface TestIdGenerator {
  next(prefix?: string): string;
  reset(): void;
}

export function createTestIdGenerator(): TestIdGenerator {
  let nextId = 1;

  return {
    next(prefix = 'id') {
      const id = `${prefix}-${nextId}`;
      nextId += 1;
      return id;
    },
    reset() {
      nextId = 1;
    },
  };
}

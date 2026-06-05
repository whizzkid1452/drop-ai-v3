export interface IdGenerator {
  next(prefix?: string): string;
}

export function createUuidGenerator(): IdGenerator {
  return {
    next(prefix) {
      const uuid =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      return prefix ? `${prefix}-${uuid}` : uuid;
    },
  };
}

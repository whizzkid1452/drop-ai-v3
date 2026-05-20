export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface CallRecorder {
  readonly calls: RecordedCall[];
  record(method: string, args?: unknown[]): void;
  getCalls(method: string): RecordedCall[];
  reset(): void;
}

export function createCallRecorder(): CallRecorder {
  const calls: RecordedCall[] = [];

  return {
    calls,
    record(method, args = []) {
      calls.push({ method, args });
    },
    getCalls(method) {
      return calls.filter(call => call.method === method);
    },
    reset() {
      calls.length = 0;
    },
  };
}

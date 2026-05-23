export type NowProvider = () => string;

export function systemNowProvider(): string {
  return new Date().toISOString();
}

export function toPrintableInput(data: string): string {
  return Array.from(data)
    .filter((character) => character >= ' ' && character !== '\u007F')
    .join('');
}

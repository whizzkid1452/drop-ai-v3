import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef } from 'react';
import { runCli } from '@/apps/cli/cli-runner';
import { useAppController } from '../AppProvider';
import { formatCommandResult } from './format-command-result';

const PROMPT = 'drop-ai> ';
const HELP_TEXT = [
  'Drop AI CLI',
  'Commands: track add, play, pause, stop, bpm <value>, master <0..1>',
  'Track controls: volume <trackId> <0..1>, mute <trackId> on|off, solo <trackId> on|off, pan <trackId> <-1..1>',
].join('\r\n');

export function CliTerminal() {
  const appController = useAppController();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const inputRef = useRef('');
  const commandQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    let isDisposed = false;
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      theme: {
        background: '#101214',
        foreground: '#e9edf1',
        cursor: '#f5f7fa',
      },
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitTerminal(fitAddon);
    terminal.focus();
    terminal.write(`${HELP_TEXT}\r\n\r\n${PROMPT}`);
    terminalRef.current = terminal;

    const resizeObserver = new ResizeObserver(() => fitTerminal(fitAddon));
    resizeObserver.observe(containerRef.current);

    const dataDisposable = terminal.onData((data) => {
      handleTerminalData(data);
    });

    function handleTerminalData(data: string): void {
      if (data === '\r') {
        const input = inputRef.current.trim();
        inputRef.current = '';
        terminal.write('\r\n');

        if (!input) {
          terminal.write(PROMPT);
          return;
        }

        commandQueueRef.current = commandQueueRef.current
          .then(async () => {
            const result = await runCli(input, { appController });
            if (isDisposed) {
              return;
            }
            terminal.write(`${formatCommandResult(result)}\r\n${PROMPT}`);
          })
          .catch(() => {
            // runCli·write 예외가 이후 모든 커맨드를 막지 않도록 큐를 회복시킨다
          });
        return;
      }

      if (data === '\u007F') {
        if (inputRef.current.length === 0) {
          return;
        }
        inputRef.current = inputRef.current.slice(0, -1);
        terminal.write('\b \b');
        return;
      }

      const printableInput = toPrintableInput(data);
      if (printableInput) {
        inputRef.current += printableInput;
        terminal.write(printableInput);
      }
    }

    return () => {
      isDisposed = true;
      dataDisposable.dispose();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [appController]);

  return (
    <div
      data-testid="cli-terminal"
      ref={containerRef}
      onClick={() => terminalRef.current?.focus()}
      style={{
        background: '#101214',
        border: '1px solid #2b3036',
        height: 280,
        minHeight: 220,
        overflow: 'hidden',
        padding: 8,
      }}
    />
  );
}

function fitTerminal(fitAddon: FitAddon): void {
  try {
    fitAddon.fit();
  } catch {
    // 터미널이 아직 부착되지 않았거나 크기가 0이면 fit이 실패할 수 있어 무시한다
  }
}

function toPrintableInput(data: string): string {
  // 붙여넣기·IME commit으로 여러 문자가 한 번에 들어올 수 있어 제어문자만 걸러 모두 반영한다
  return Array.from(data)
    .filter((character) => character >= ' ' && character !== '\u007F')
    .join('');
}

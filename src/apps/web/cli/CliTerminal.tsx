import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef } from 'react';
import { runCli } from '@/apps/cli/cli-runner';
import { useAppController, useSessionState } from '../AppProvider';
import type { UploadedSessionInfo } from '../upload/upload-session-flow';
import { formatCommandResult } from './format-command-result';
import { downloadSessionExportResult } from './session-export-download';
import { toPrintableInput } from './terminal-input';
import { createCliWelcomeText, formatSessionStatus } from './terminal-text';
import * as styles from './CliTerminal.css';

const PROMPT = 'drop-ai> ';

export interface CliTerminalProps {
  uploadInfo: UploadedSessionInfo;
}

export function CliTerminal({ uploadInfo }: CliTerminalProps) {
  const appController = useAppController();
  const session = useSessionState();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const inputRef = useRef('');
  const commandQueueRef = useRef(Promise.resolve());
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
    terminal.write(`${createCliWelcomeText(uploadInfo)}\r\n\r\n${PROMPT}`);
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
            const result = await runCli(input, {
              appController,
              getStatusText: () => formatSessionStatus(sessionRef.current),
              uploadInfo,
            });
            if (isDisposed) {
              return;
            }
            const downloadMessage = downloadSessionExportResult(result)
              ? '\r\nDownload started.'
              : '';
            terminal.write(
              `${formatCommandResult(result)}${downloadMessage}\r\n${PROMPT}`
            );
          })
          .catch(() => {
            // Keep the Promise queue usable after runCli or terminal.write throws.
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
  }, [appController, uploadInfo]);

  return (
    <div
      className={styles.terminalHost}
      data-testid="cli-terminal"
      ref={containerRef}
      onClick={() => terminalRef.current?.focus()}
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

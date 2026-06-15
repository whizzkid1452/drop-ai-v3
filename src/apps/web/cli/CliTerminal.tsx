import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { runCli } from '@/apps/cli/cli-runner';
import { useAppController, useSessionState } from '../AppProvider';
import type { UploadedSessionInfo } from '../upload/upload-session-flow';
import {
  createCliCommandButtons,
  groupCliCommandButtons,
} from './cli-command-buttons';
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
  const commandButtonGroups = useMemo(
    () => groupCliCommandButtons(createCliCommandButtons(uploadInfo)),
    [uploadInfo]
  );

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const executeCliInput = useCallback(
    (input: string, options: { echoInput: boolean }): void => {
      const commandInput = input.trim();
      const terminal = terminalRef.current;

      if (!terminal || !commandInput) {
        return;
      }

      if (options.echoInput) {
        if (inputRef.current.length > 0) {
          terminal.write(`\r\n${PROMPT}`);
        }
        inputRef.current = '';
        terminal.write(`${commandInput}\r\n`);
        terminal.focus();
      }

      commandQueueRef.current = commandQueueRef.current
        .then(async () => {
          const result = await runCli(commandInput, {
            appController,
            getStatusText: () => formatSessionStatus(sessionRef.current),
            uploadInfo,
          });

          if (terminalRef.current !== terminal) {
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
    },
    [appController, uploadInfo]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

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

        executeCliInput(input, { echoInput: false });
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
      dataDisposable.dispose();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [executeCliInput, uploadInfo]);

  return (
    <div className={styles.cliSurface}>
      <div
        className={styles.commandButtonPanel}
        data-testid="cli-command-buttons"
      >
        {commandButtonGroups.map((buttonGroup) => (
          <section
            className={styles.commandGroup}
            key={buttonGroup.group}
            aria-label={`${buttonGroup.group} commands`}
          >
            <h3 className={styles.commandGroupTitle}>{buttonGroup.group}</h3>
            <div className={styles.commandButtonGrid}>
              {buttonGroup.commands.map((command) => (
                <button
                  aria-label={`Run ${command.commandInput}`}
                  className={styles.commandButton}
                  data-command-usage={command.usage}
                  key={command.usage}
                  onClick={() =>
                    executeCliInput(command.commandInput, { echoInput: true })
                  }
                  title={command.commandInput}
                  type="button"
                >
                  {command.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div
        className={styles.terminalHost}
        data-testid="cli-terminal"
        ref={containerRef}
        onClick={() => terminalRef.current?.focus()}
      />
    </div>
  );
}

function fitTerminal(fitAddon: FitAddon): void {
  try {
    fitAddon.fit();
  } catch {
    // 터미널이 아직 부착되지 않았거나 크기가 0이면 fit이 실패할 수 있어 무시한다
  }
}

import { execFile } from 'node:child_process';

export interface GitRunOptions {
  cwd?: string;
  timeoutMs: number;
  /** Cap on captured stdout/stderr to prevent memory exhaustion. */
  maxBufferBytes?: number;
}

const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Runs git with an argument array (never a shell string). Disables interactive
 * credential prompts and hooks from the repository being analyzed.
 * Error output is never returned to callers verbatim, because it can include
 * credentialed URLs or local paths; callers receive a GitCommandError instead.
 */
export class GitCommandError extends Error {
  readonly exitCode: number | null;
  readonly timedOut: boolean;

  constructor(message: string, exitCode: number | null, timedOut: boolean) {
    super(message);
    this.name = 'GitCommandError';
    this.exitCode = exitCode;
    this.timedOut = timedOut;
  }
}

export function runGit(args: readonly string[], options: GitRunOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      [...args],
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        maxBuffer: options.maxBufferBytes ?? DEFAULT_MAX_BUFFER,
        windowsHide: true,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          GIT_TERMINAL_PROMPT: '0',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_ASKPASS: 'echo',
        },
      },
      (error, stdout) => {
        if (error) {
          const killed = (error as NodeJS.ErrnoException & { killed?: boolean }).killed === true;
          const exitCode = typeof error.code === 'number' ? error.code : null;
          reject(new GitCommandError(`git ${args[0] ?? ''} failed`, exitCode, killed));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

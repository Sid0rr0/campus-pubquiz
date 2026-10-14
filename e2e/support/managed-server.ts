import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { PATHS } from './env';

const POLL_INTERVAL_MS = 200;
const STOP_TIMEOUT_MS = 10_000;

export interface ManagedServerOptions {
  /** Short name used for the pid file, the log file and error messages. */
  name: string;
  port: number;
  /** URL that answers 2xx/3xx once the server is ready for requests. */
  readyUrl: string;
  /** The executable (`node`). */
  command: string;
  args: readonly string[];
  cwd: string;
  env: Readonly<Record<string, string>>;
  /** Text the running process's command line contains (a server may retitle itself), used to recognise it before stopping a pid from an old run. */
  processHint: string;
  startTimeoutMs: number;
}

/**
 * A server process that outlives the Playwright process that spawned it, so
 * the runner (global setup) starts it and a worker can stop and start it again
 * (the restart journey). The pid file is the only shared state: any process
 * can find the server and stop it. The server runs in its own process group,
 * so stopping it also stops anything it spawned.
 */
export class ManagedServer {
  constructor(private readonly options: ManagedServerOptions) {}

  private get pidFile(): string {
    return path.join(PATHS.stateDir, `${this.options.name}.pid`);
  }

  private get logFile(): string {
    return path.join(PATHS.logDir, `${this.options.name}.log`);
  }

  /** Spawns the server and resolves once it answers. Fails if the port is taken by something else. */
  async start(): Promise<void> {
    await this.stop();
    if (await isPortInUse(this.options.port)) {
      throw new Error(
        `Port ${this.options.port} is already in use, so the E2E ${this.options.name} cannot start. ` +
          `E2E uses its own ports; stop whatever is listening there and run again.`,
      );
    }
    fs.mkdirSync(PATHS.stateDir, { recursive: true });
    fs.mkdirSync(PATHS.logDir, { recursive: true });
    const log = fs.openSync(this.logFile, 'a');
    const child = spawn(this.options.command, [...this.options.args], {
      cwd: this.options.cwd,
      env: { ...process.env, ...this.options.env },
      detached: true,
      stdio: ['ignore', log, log],
    });
    fs.closeSync(log);
    child.unref();
    if (child.pid === undefined) {
      throw new Error(`Could not spawn the E2E ${this.options.name}.`);
    }
    fs.writeFileSync(this.pidFile, String(child.pid));
    await this.waitUntilReady(child.pid);
  }

  /** Stops the server (if one is running) and resolves once its port is free. */
  async stop(): Promise<void> {
    const pid = this.readPid();
    fs.rmSync(this.pidFile, { force: true });
    if (pid === null || !isProcessAlive(pid) || !this.isOurProcess(pid)) return;
    killProcessGroup(pid, 'SIGTERM');
    const hasExited = await waitFor(
      () => !isProcessAlive(pid),
      STOP_TIMEOUT_MS,
    );
    if (!hasExited) killProcessGroup(pid, 'SIGKILL');
    const isPortFree = await waitFor(
      async () => !(await isPortInUse(this.options.port)),
      STOP_TIMEOUT_MS,
    );
    if (!isPortFree) {
      throw new Error(
        `The E2E ${this.options.name} was stopped but port ${this.options.port} is still in use.`,
      );
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /** Guards against a pid file left by a crashed run whose pid now belongs to an unrelated process. */
  private isOurProcess(pid: number): boolean {
    try {
      const commandLine = execFileSync(
        'ps',
        ['-p', String(pid), '-o', 'command='],
        {
          encoding: 'utf8',
        },
      );
      return commandLine.includes(this.options.processHint);
    } catch {
      return false;
    }
  }

  private readPid(): number | null {
    try {
      const pid = Number.parseInt(fs.readFileSync(this.pidFile, 'utf8'), 10);
      return Number.isInteger(pid) ? pid : null;
    } catch {
      return null;
    }
  }

  private async waitUntilReady(pid: number): Promise<void> {
    const isReady = await waitFor(async () => {
      if (!isProcessAlive(pid)) {
        throw new Error(
          `The E2E ${this.options.name} exited while starting. See ${this.logFile}.`,
        );
      }
      return answers(this.options.readyUrl);
    }, this.options.startTimeoutMs);
    if (!isReady) {
      throw new Error(
        `The E2E ${this.options.name} did not answer ${this.options.readyUrl} within ${this.options.startTimeoutMs} ms. See ${this.logFile}.`,
      );
    }
  }
}

async function answers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { redirect: 'manual' });
    return response.status < 500;
  } catch {
    return false;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    // The group is already gone.
  }
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return false;
}

import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

type Mode = 'install' | 'uninstall';

function parseMode(): Mode {
  const arg = process.argv.find(a => a.startsWith('--mode='));
  return arg?.slice('--mode='.length) === 'uninstall' ? 'uninstall' : 'install';
}

// install-gui always lives at <repo>/install-gui, so this is a safe default
// for local runs; the shell scripts that actually launch this app set
// OMARCHY_TOUCHBAR_REPO_DIR explicitly since they already know their own root.
const REPO_ROOT = process.env.OMARCHY_TOUCHBAR_REPO_DIR ?? path.join(__dirname, '..', '..', '..');
const MODE = parseMode();
const SCRIPT = MODE === 'uninstall' ? 'uninstall.sh' : 'install.sh';
const SCRIPT_ARGS = [SCRIPT, MODE, '--gui'];

// install.sh traps ERR but never INT/TERM, so a terminated script runs no
// cleanup of its own. In GUI mode it escalates through pkexec, so a bare kill
// can cut a privileged helper off mid-operation. This is the window a SIGTERM
// gets before we escalate to SIGKILL.
const KILL_GRACE_MS = 5000;

let mainWindow: BrowserWindow | null = null;
let child: ChildProcessWithoutNullStreams | null = null;
let stdoutRl: readline.Interface | null = null;
let stderrRl: readline.Interface | null = null;
let killTimer: NodeJS.Timeout | null = null;
let killing = false;
let closePending = false;
let lockHeld = false;

// Nothing in install.sh takes a lock, so two instances would race on the same
// $INSTALL_DIR, on pacman's transaction, and on the systemd unit. XDG_RUNTIME_DIR
// is per-user and cleared at logout, so a lock left by a crash is rare but not
// impossible — hence the stale-owner takeover below.
const LOCK_PATH = path.join(process.env.XDG_RUNTIME_DIR || os.tmpdir(), 'omarchy-touchbar-install.lock');

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function acquireLock(): string | null {
  try {
    const fd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    lockHeld = true;
    return null;
  } catch {
    // Fall through to the stale-owner check rather than refusing outright.
  }
  try {
    const owner = Number(fs.readFileSync(LOCK_PATH, 'utf8').trim());
    if (Number.isFinite(owner) && owner > 0 && owner !== process.pid && pidAlive(owner)) {
      return `Another installer is already running (process ${owner}). Close it before starting this one — running two at once can leave the system half-configured.`;
    }
  } catch {
    // Unreadable or corrupt lock: treat it as stale.
  }
  try {
    fs.writeFileSync(LOCK_PATH, String(process.pid));
    lockHeld = true;
  } catch {
    // Could not record ownership; proceed unlocked rather than block the install.
  }
  return null;
}

function releaseLock(): void {
  if (!lockHeld) return;
  lockHeld = false;
  try {
    const owner = Number(fs.readFileSync(LOCK_PATH, 'utf8').trim());
    if (owner === process.pid) fs.unlinkSync(LOCK_PATH);
  } catch {
    // Already gone, or someone else owns it now.
  }
}

function send(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args);
}

function hasLiveChild(): boolean {
  return child !== null && child.exitCode === null && child.signalCode === null;
}

// install-gui is the t2linux (upstream) front-end, so on install it seeds the
// t2linux profile into the generated assets, exactly as install.sh does: the
// gitignored 99-omarchy-touchbar.rules and the repo-root .env. Only fills targets
// that are absent — an existing .env/rules are user-editable and left alone.
function seedT2linuxAssets(): void {
  if (MODE !== 'install') return;
  const rulesSrc = path.join(REPO_ROOT, 'system', '99-omarchy-touchbar-t2linux.rules');
  const rulesDst = path.join(REPO_ROOT, 'system', '99-omarchy-touchbar.rules');
  const envSrc = path.join(REPO_ROOT, '.env.example.t2linux');
  const envDst = path.join(REPO_ROOT, '.env');
  try {
    if (fs.existsSync(rulesSrc) && !fs.existsSync(rulesDst)) {
      fs.copyFileSync(rulesSrc, rulesDst);
    }
    if (fs.existsSync(envSrc) && !fs.existsSync(envDst)) {
      fs.copyFileSync(envSrc, envDst);
    }
  } catch {
    // Non-fatal: install.sh regenerates these during its own analyze/deploy.
  }
}

// A wrong REPO_ROOT is the most likely first-run failure on a machine this was
// never set up on. Without this, spawn succeeds and bash exits 127 with nothing
// useful on stdout, which reaches the user as a bare number.
function preflightFailure(): string | null {
  const scriptPath = path.join(REPO_ROOT, SCRIPT);
  if (!fs.existsSync(scriptPath)) {
    return `The installer script was not found at ${scriptPath}. The graphical installer is not installed correctly — reinstall it from its plugin directory.`;
  }
  try {
    fs.accessSync(scriptPath, fs.constants.R_OK);
  } catch {
    return `The installer script at ${scriptPath} could not be read. Check the file's permissions.`;
  }
  return null;
}

function createWindow(): void {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.round(screenW / 2),
    height: Math.round(screenH / 2),
    minWidth: 640,
    minHeight: 480,
    center: true,
    title: MODE === 'uninstall' ? 'Uninstall omarchy-touchbar' : 'Install omarchy-touchbar',
    frame: false,
    backgroundColor: '#0d0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = win;

  // The window only ever renders the bundled local page.
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.on('close', event => {
    if (!hasLiveChild()) return;
    event.preventDefault();
    requestClose();
  });
  win.on('closed', () => {
    mainWindow = null;
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

// Signal the whole process group, not just bash. install.sh runs npm ci, pacman,
// rsync and pkexec with inherited stdio; signalling only the shell leaves those
// grandchildren running against the same filesystem — an orphaned pacman holds
// /var/lib/pacman/db.lck, which then blocks the retry.
function killGroup(signal: NodeJS.Signals): void {
  const proc = child;
  if (!proc?.pid) return;
  try {
    process.kill(-proc.pid, signal);
  } catch {
    try {
      proc.kill(signal);
    } catch {
      // Already gone.
    }
  }
}

// SIGTERM first so a script that can clean up gets to, then SIGKILL only if it
// is still alive. The renderer is told which, so an interrupted run can say so.
function killGracefully(): void {
  if (!child) return;
  killing = true;
  if (killTimer) clearTimeout(killTimer);
  killGroup('SIGTERM');
  killTimer = setTimeout(() => {
    if (child && child.exitCode === null) killGroup('SIGKILL');
  }, KILL_GRACE_MS);
}

// Every close path funnels here. With a script running, the renderer asks the
// user first — the process may be mid-purge or mid-deploy, and a silent kill
// leaves the system half-changed with the firmware Touch Bar possibly unrestored.
function requestClose(): void {
  if (!hasLiveChild()) {
    mainWindow?.close();
    return;
  }
  if (closePending) return;
  closePending = true;
  send('wizard:ask-close');
}

function startProcess(): void {
  if (child) return;

  const problem = preflightFailure();
  if (problem) {
    send('wizard:event', { type: 'error', phase: 'startup', message: problem });
    return;
  }

  const busy = acquireLock();
  if (busy) {
    send('wizard:event', { type: 'error', phase: 'startup', message: busy });
    return;
  }

  // Force a UTF-8 locale: under a C/POSIX locale npm and pacman emit bytes that
  // are not valid UTF-8, which reach the renderer as replacement characters.
  const env = { ...process.env, LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8' };
  // detached puts the script in its own process group so killGroup can reach the
  // npm/pacman/rsync children it forks.
  child = spawn('bash', SCRIPT_ARGS, { cwd: REPO_ROOT, env, detached: true });

  // The script can exit between a question being shown and the answer being
  // written. Swallow the resulting EPIPE rather than taking down the main process.
  child.stdin.on('error', () => {});

  stdoutRl = readline.createInterface({ input: child.stdout });
  stdoutRl.on('line', line => {
    if (!line.trim()) return;
    try {
      send('wizard:event', JSON.parse(line));
    } catch {
      send('wizard:event', { type: 'log', phase: MODE, level: 'info', text: line });
    }
  });

  stderrRl = readline.createInterface({ input: child.stderr });
  // npm, node-gyp and pacman write large volumes of benign stderr on a
  // successful run. Severity comes from the script's own JSON events; raw
  // stderr is neutral so a clean build doesn't look like a wall of warnings.
  stderrRl.on('line', line => {
    if (!line.trim()) return;
    send('wizard:event', { type: 'log', phase: MODE, level: 'info', text: line });
  });

  child.on('error', err => {
    send('wizard:event', { type: 'error', phase: 'startup', message: `The installer could not be started: ${err.message}` });
  });

  child.on('close', (code, signal) => {
    stdoutRl?.close();
    stderrRl?.close();
    stdoutRl = stderrRl = null;
    if (killTimer) {
      clearTimeout(killTimer);
      killTimer = null;
    }
    send('wizard:process-exit', { code, signal, interrupted: killing });
    child = null;
    killing = false;
    releaseLock();
  });
}

ipcMain.on('wizard:start', () => startProcess());
ipcMain.on('wizard:answer', (_event, answer: string) => {
  const proc = child;
  if (!proc || proc.exitCode !== null || proc.stdin.destroyed) return;
  try {
    proc.stdin.write(`${JSON.stringify({ answer })}\n`);
  } catch {
    // The script exited before the answer landed; nothing to answer.
  }
});
// Stopping the script is not the same as closing the window. The window stays
// so the result screen can record what was interrupted and offer a retry —
// after a destructive stop that record is the point.
ipcMain.on('wizard:close-confirmed', () => {
  closePending = false;
  killGracefully();
});
ipcMain.on('wizard:close-cancelled', () => {
  closePending = false;
});

ipcMain.handle('wizard:mode', () => MODE);

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:toggleMaximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => requestClose());

app.whenReady().then(() => {
  seedT2linuxAssets();
  createWindow();
});

app.on('window-all-closed', () => {
  if (hasLiveChild()) killGracefully();
  else releaseLock();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', releaseLock);

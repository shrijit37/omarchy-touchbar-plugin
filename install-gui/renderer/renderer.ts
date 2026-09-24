export {};

declare global {
  interface Window {
    wizardApi: {
      mode: () => Promise<'install' | 'uninstall'>;
      start: () => void;
      answer: (value: string) => void;
      closeConfirmed: () => void;
      closeCancelled: () => void;
      onEvent: (cb: (event: unknown) => void) => void;
      onProcessExit: (cb: (result: ExitResult) => void) => void;
      onAskClose: (cb: () => void) => void;
    };
    windowApi: {
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
    };
  }
}

type WizardEvent =
  | { type: 'phase'; name: string; status: 'start' | 'done' }
  | { type: 'log'; phase: string; level: 'info' | 'warn'; text: string }
  | { type: 'question'; kind: 'continue' | 'purge' }
  | { type: 'error'; phase: string; message: string }
  | { type: 'done'; needsRelogin?: boolean };

interface ExitResult {
  code: number | null;
  signal: string | null;
  interrupted: boolean;
}

type Mode = 'install' | 'uninstall';

const STEPS: Record<Mode, { id: string; label: string }[]> = {
  install: [
    { id: 'analysis', label: 'Analysis' },
    { id: 'purge', label: 'Purge' },
    { id: 'deploy', label: 'Deploy' },
  ],
  uninstall: [{ id: 'uninstall', label: 'Uninstall' }],
};

const WELCOME_COPY: Record<Mode, { title: string; paragraphs: string[]; beginLabel: string; danger?: boolean }> = {
  install: {
    title: 'Install omarchy-touchbar',
    paragraphs: [
      'This replaces the existing Touch Bar interface. It analyzes your system, removes any conflicting tiny-dfr or mac-touchbar-plus installation (with your explicit confirmation), then builds and deploys omarchy-touchbar.',
      'If your user needs to be added to the video or input groups, you will need to log out and back in afterward.',
      'Provided without warranty — used entirely at your own risk.',
    ],
    beginLabel: 'Begin Installation',
  },
  uninstall: {
    title: 'Uninstall omarchy-touchbar',
    paragraphs: [
      'This removes the omarchy-touchbar user service and udev rules and restores the firmware Touch Bar interface.',
      'Project files, npm dependencies, system packages and video/input group memberships are not removed.',
    ],
    beginLabel: 'Uninstall',
    danger: true,
  },
};

const QUESTION_COPY: Record<string, { title: string; body: string; confirmLabel: string; confirmValue: string; danger?: boolean }> = {
  continue: {
    title: 'Ready to deploy',
    body: 'No conflicting Touch Bar daemon was found. Continue installing dependencies and deploying omarchy-touchbar?',
    confirmLabel: 'Continue',
    confirmValue: 'CONTINUE',
  },
  purge: {
    title: 'Remove the existing Touch Bar daemon',
    body: 'A conflicting tiny-dfr or mac-touchbar-plus installation was found. It will be stopped, disabled and removed before omarchy-touchbar is deployed. This cannot be undone automatically.',
    confirmLabel: 'Purge and continue',
    confirmValue: 'PURGE',
    danger: true,
  },
};

// install.sh's ERR trap reports the failing line as `line 948: <shell command>`.
// That is diagnostic, not an explanation, so it goes to the detail block and the
// user gets a sentence they can act on.
const RAW_COMMAND = /^line \d+: /;

const LOG_MAX_LINES = 2000;
const LOG_MAX_CHARS = 4000;

let mode: Mode = 'install';
let settled = false;
let currentPhase = '';
let droppedMarker: HTMLElement | null = null;
let lastFocus: HTMLElement | null = null;
let activeConfirm: { onConfirm: () => void; onCancel: () => void } | null = null;

const FOCUS_TARGET: Record<string, string> = {
  'screen-welcome': 'welcome-title',
  'screen-working': 'stepper',
  'screen-result': 'result-title',
};

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id} — the installer window is broken.`);
  return el;
}

function showScreen(id: string, focus = true): void {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  $(id).classList.add('active');
  if (focus) $(FOCUS_TARGET[id])?.focus();
}

function announce(text: string): void {
  $('status-live').textContent = text;
}

function renderWelcome(): void {
  const copy = WELCOME_COPY[mode];
  $('welcome-title').textContent = copy.title;
  const body = $('welcome-body');
  body.innerHTML = '';
  for (const p of copy.paragraphs) {
    const el = document.createElement('p');
    el.textContent = p;
    body.appendChild(el);
  }
  const begin = $('begin-btn') as HTMLButtonElement;
  begin.textContent = copy.beginLabel;
  begin.className = copy.danger ? 'danger' : '';
}

function renderStepper(): void {
  const stepper = $('stepper');
  stepper.innerHTML = '';
  for (const [i, step] of STEPS[mode].entries()) {
    const li = document.createElement('li');
    li.id = `step-${step.id}`;
    li.innerHTML = `<span class="dot">${i + 1}</span><span>${step.label}</span>`;
    stepper.appendChild(li);
  }
}

function setStepState(stepId: string, state: 'active' | 'done'): void {
  const steps = STEPS[mode];
  const idx = steps.findIndex(s => s.id === stepId);
  if (idx === -1) return;
  steps.forEach((s, i) => {
    const li = document.getElementById(`step-${s.id}`);
    if (!li) return;
    li.classList.remove('active', 'done');
    if (i < idx || (i === idx && state === 'done')) li.classList.add('done');
    else if (i === idx) li.classList.add('active');
    if (i === idx) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  });
}

function resetSteps(): void {
  for (const step of STEPS[mode]) setStepState(step.id, 'done');
  renderStepper();
}

// The log is capped so a verbose native build cannot grow the DOM without
// bound, and each line is capped so one enormous compiler error cannot stall
// layout. What was dropped is stated rather than silently lost.
let droppedCount = 0;

function noteDropped(): void {
  droppedCount += 1;
  if (!droppedMarker) {
    droppedMarker = document.createElement('div');
    droppedMarker.className = 'log-line dropped';
    $('log').prepend(droppedMarker);
  }
  droppedMarker.textContent = `— ${droppedCount.toLocaleString()} earlier line${droppedCount === 1 ? '' : 's'} dropped —`;
}

function appendLog(text: string, kind: 'info' | 'warn' | 'error' | 'phase' = 'info'): void {
  const log = $('log');
  document.getElementById('log-placeholder')?.remove();
  const shown =
    text.length > LOG_MAX_CHARS
      ? `${text.slice(0, LOG_MAX_CHARS)} … [truncated, ${(text.length - LOG_MAX_CHARS).toLocaleString()} more characters]`
      : text;
  const line = document.createElement('div');
  line.className = `log-line ${kind}`;
  line.textContent = shown;
  log.appendChild(line);
  // The marker sits at index 0 and is never a trim victim — otherwise the very
  // next line would evict the notice that said anything had been dropped. The
  // index is recomputed each pass because noteDropped() prepends the marker
  // mid-loop, which shifts everything after it.
  while (log.childElementCount - (droppedMarker ? 1 : 0) > LOG_MAX_LINES) {
    const victim = log.children[droppedMarker ? 1 : 0];
    if (!victim) break;
    victim.remove();
    noteDropped();
  }
  log.scrollTop = log.scrollHeight;
}

function showConfirm(opts: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}): void {
  activeConfirm = opts;
  lastFocus = document.activeElement as HTMLElement | null;
  $('question-title').textContent = opts.title;
  $('question-body').textContent = opts.body;
  const actions = $('question-actions');
  actions.innerHTML = '';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => hideConfirm(opts.onCancel));

  const confirm = document.createElement('button');
  confirm.type = 'button';
  if (opts.danger) confirm.className = 'danger';
  confirm.textContent = opts.confirmLabel;
  confirm.addEventListener('click', () => hideConfirm(opts.onConfirm));

  actions.append(cancel, confirm);
  $('question-overlay').classList.remove('hidden');
  confirm.focus();
}

function hideConfirm(run: () => void): void {
  $('question-overlay').classList.add('hidden');
  activeConfirm = null;
  lastFocus?.focus();
  run();
}

function showResult(opts: {
  ok: boolean;
  title: string;
  message: string;
  detail?: string;
  retryable?: boolean;
}): void {
  if (settled) return;
  settled = true;
  hideOverlay();
  const icon = $('result-icon');
  icon.className = opts.ok ? 'ok' : 'error';
  icon.innerHTML = opts.ok
    ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
  $('result-title').textContent = opts.title;
  $('result-message').textContent = opts.message;

  const detail = $('result-detail');
  if (opts.detail) {
    detail.textContent = opts.detail;
    detail.classList.remove('hidden');
  } else {
    detail.textContent = '';
    detail.classList.add('hidden');
  }

  const retry = $('retry-btn') as HTMLButtonElement;
  retry.hidden = !opts.retryable;

  announce(`${opts.title}. ${opts.message}`);
  showScreen('screen-result');
}

function hideOverlay(): void {
  $('question-overlay').classList.add('hidden');
  activeConfirm = null;
}

// install.sh exits 1 for every semantic failure — missing hardware, unsupported
// distro, declined, package resolution — so the code alone cannot classify it.
// These are the cases where the code itself is diagnostic.
function diagnoseExit({ code, signal, interrupted }: ExitResult): { title: string; message: string; detail?: string } {
  if (interrupted) {
    return {
      title: 'Installation stopped',
      message:
        'The installer was stopped before it finished. Changes it already made to your system have not been rolled back — the log above shows how far it got. Running it again is safe: it re-checks your system and only does what is still missing.',
    };
  }
  if (signal) {
    return {
      title: 'Installer was killed',
      message: `The installer was terminated by ${signal} before it reported a result. This usually means the system killed it for running out of memory. Running it again is safe.`,
      detail: `signal: ${signal}`,
    };
  }
  switch (code) {
    case 127:
      return {
        title: 'Installer not found',
        message: 'The installer script is missing from where this app expects it. The graphical installer is not installed correctly — reinstall it from its plugin directory.',
      };
    case 126:
      return {
        title: 'Installer cannot be run',
        message: 'The installer script was found but is not executable. Check its file permissions.',
      };
    case 2:
      return {
        title: 'This system is not supported',
        message: 'The installer does not support this distribution, or it was started with options it cannot use. See the log above for the specific reason.',
      };
    case 1:
      return {
        title: 'Installation failed',
        message: 'The installer reported a failure. The reason is in the log above.',
      };
    case 0:
      return {
        title: 'Installer finished without confirming',
        message: 'The installer exited successfully but never reported that it was done. Check the log above before assuming the Touch Bar was configured.',
      };
    default:
      return {
        title: 'Installer stopped unexpectedly',
        message: 'The installer ended before it reported a result. The log above has the last thing it did.',
        detail: `exit code: ${code}`,
      };
  }
}

function handleEvent(event: WizardEvent): void {
  switch (event.type) {
    case 'phase': {
      currentPhase = event.name;
      setStepState(event.name, event.status === 'done' ? 'done' : 'active');
      appendLog(`${event.name} ${event.status === 'start' ? 'started' : 'finished'}`, 'phase');
      if (event.status === 'start') announce(`${event.name} started.`);
      break;
    }
    case 'log':
      appendLog(event.text, event.level);
      break;
    case 'question': {
      // A question can arrive after the run has already settled, or while one is
      // already open. Both would strand the script waiting on stdin.
      const copy = QUESTION_COPY[event.kind];
      if (settled || activeConfirm || !copy) return;
      showConfirm({
        title: copy.title,
        body: copy.body,
        confirmLabel: copy.confirmLabel,
        danger: copy.danger,
        onConfirm: () => window.wizardApi.answer(copy.confirmValue),
        onCancel: () => window.wizardApi.answer('no'),
      });
      break;
    }
    case 'error': {
      appendLog(event.message, 'error');
      const isRawCommand = RAW_COMMAND.test(event.message);
      showResult({
        ok: false,
        title: isRawCommand ? 'A step of the installer failed' : 'Installation failed',
        message: isRawCommand
          ? `The installer stopped during ${currentPhase || 'an early step'} on a command it did not expect to fail. The log above has the output that led up to it.`
          : event.message,
        detail: isRawCommand ? event.message : undefined,
        retryable: true,
      });
      break;
    }
    case 'done':
      if (mode === 'install' && event.needsRelogin) {
        showResult({
          ok: true,
          title: 'Installed — log out required',
          message: 'omarchy-touchbar is enabled but was not started. Log out and back in to activate the new group memberships.',
        });
      } else if (mode === 'install') {
        showResult({ ok: true, title: 'Installation complete', message: 'omarchy-touchbar is active. No logout is required.' });
      } else {
        showResult({
          ok: true,
          title: 'Uninstalled',
          message: 'omarchy-touchbar has been removed. The firmware Touch Bar interface is restored.',
        });
      }
      break;
  }
}

function beginRun(): void {
  settled = false;
  currentPhase = '';
  droppedMarker = null;
  droppedCount = 0;
  ($('begin-btn') as HTMLButtonElement).disabled = true;
  appendLog('— starting —', 'phase');
  showScreen('screen-working');
  window.wizardApi.start();
}

function renderFatal(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if ($('screen-result').classList.contains('active')) return;
  showResult({
    ok: false,
    title: 'The installer could not start',
    message: 'This window failed to load properly, so nothing was run and your system was not changed.',
    detail: message,
  });
}

async function main(): Promise<void> {
  mode = await window.wizardApi.mode();
  renderWelcome();
  renderStepper();

  $('begin-btn').addEventListener('click', beginRun);

  $('retry-btn').addEventListener('click', () => {
    resetSteps();
    beginRun();
  });

  window.wizardApi.onEvent(e => handleEvent(e as WizardEvent));

  window.wizardApi.onProcessExit(result => {
    if (settled) return;
    const { title, message, detail } = diagnoseExit(result);
    showResult({ ok: false, title, message, detail, retryable: true });
  });

  // The script may be mid-purge or mid-deploy. install.sh traps ERR but never
  // INT/TERM, so stopping it rolls nothing back — ask before that happens.
  window.wizardApi.onAskClose(() => {
    showConfirm({
      title: 'Stop the installer?',
      body: `The installer is still running${
        currentPhase ? ` (currently: ${currentPhase})` : ''
      }. Stopping it will not undo anything it has already changed — if it is partway through removing the old Touch Bar daemon, your Touch Bar may have neither the old daemon nor the new one until you run the installer again.`,
      confirmLabel: 'Stop anyway',
      danger: true,
      onConfirm: () => window.wizardApi.closeConfirmed(),
      onCancel: () => window.wizardApi.closeCancelled(),
    });
  });

  // The overlay is a blocking decision — the script is waiting on stdin — so it
  // must be perceivable and must not be escapable by tabbing out of it.
  document.addEventListener('keydown', event => {
    if ($('question-overlay').classList.contains('hidden')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (activeConfirm) hideConfirm(activeConfirm.onCancel);
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from($('question-actions').querySelectorAll('button'));
    if (buttons.length === 0) return;
    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  $('close-btn').addEventListener('click', () => window.windowApi.close());
  $('win-minimize').addEventListener('click', () => window.windowApi.minimize());
  $('win-maximize').addEventListener('click', () => window.windowApi.toggleMaximize());
  $('win-close').addEventListener('click', () => window.windowApi.close());
}

main().catch(renderFatal);

import type { ConfigData, DesktopAppEntry, JsonValue, SectionName } from './types';

let state: ConfigData = {};
let iconChoices: string[] = [];
let domCodeToKeyName: Record<string, string> = {};
let keyNames: Record<string, number> = {};
let codeToKeyName: Record<number, string> = {};
let desktopAppsCache: DesktopAppEntry[] | null = null;
let iconThemesCache: string[] | null = null;

interface NavGroup {
  label: string;
  sections: SectionName[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: 'Display & Power', sections: ['DISPLAY', 'SLEEP', 'LAYER_TRANSITION'] },
  { label: 'Dock', sections: ['DOCK'] },
  {
    label: 'Keyboard Shortcuts',
    sections: ['DEFAULT_BROWSER_KEYS', 'BROWSER_KEY_OVERRIDES', 'DEFAULT_VSCODE_KEYS', 'VSCODE_KEY_OVERRIDES'],
  },
  {
    label: 'Panels',
    sections: ['ESC_KEY', 'ACTIVE_WINDOW', 'SCREENSHOT', 'DOLPHIN', 'KONSOLE', 'SYSTEMBAR', 'CAVA', 'FN_LAYER', 'FN_KEYS'],
  },
];

const SECTION_ORDER: SectionName[] = NAV_GROUPS.flatMap(g => g.sections);

const SECTION_LABELS: Record<SectionName, string> = {
  DISPLAY: 'Display', SLEEP: 'Sleep', DOCK: 'Dock',
  DEFAULT_BROWSER_KEYS: 'Browser Keys', BROWSER_KEY_OVERRIDES: 'Browser Overrides',
  DEFAULT_VSCODE_KEYS: 'VS Code Keys', VSCODE_KEY_OVERRIDES: 'VS Code Overrides',
  ESC_KEY: 'Esc Key', ACTIVE_WINDOW: 'Active Window', SCREENSHOT: 'Screenshot',
  LAYER_TRANSITION: 'Transitions', DOLPHIN: 'Dolphin', KONSOLE: 'Konsole',
  SYSTEMBAR: 'System Bar', CAVA: 'Audio Visualizer', FN_LAYER: 'Fn Layer', FN_KEYS: 'Fn Keys',
};

const SECTION_DESCRIPTIONS: Record<SectionName, string> = {
  DISPLAY: 'Screen timing and brightness',
  SLEEP: 'Touch Bar behavior around system sleep',
  LAYER_TRANSITION: 'Timing for switching between layers',
  DOCK: "Pinned apps and the dock's appearance",
  DEFAULT_BROWSER_KEYS: 'Shortcuts sent to any browser window',
  BROWSER_KEY_OVERRIDES: 'Per-browser shortcut overrides',
  DEFAULT_VSCODE_KEYS: 'Shortcuts sent to any VS Code window',
  VSCODE_KEY_OVERRIDES: 'Per-editor shortcut overrides',
  ESC_KEY: 'The on-screen Esc key for wide Touch Bars',
  ACTIVE_WINDOW: 'How the focused window is detected',
  SCREENSHOT: 'Touch Bar screenshot shortcut',
  DOLPHIN: 'Dolphin file manager panel',
  KONSOLE: 'Konsole terminal panel',
  SYSTEMBAR: 'CPU, memory, and network stats',
  CAVA: 'Audio visualizer bars',
  FN_LAYER: 'How the Fn key reaches the F-key layer',
  FN_KEYS: 'Extra keys shown after F1–F12 in the Fn-key layer',
};

const BROWSER_ACTIONS = ['back', 'forward', 'reload', 'home', 'newTab', 'closeTab', 'nextTab', 'prevTab'];
const VSCODE_ACTIONS = [
  'back', 'forward', 'prevEditor', 'nextEditor', 'toggleSidebar', 'toggleTerminal',
  'run', 'stop', 'stepOver', 'stepInto', 'stepOut', 'undo', 'redo', 'find', 'replace',
  'commandPalette', 'settings',
];

interface FieldMeta {
  /** Plain-language name for the control, replacing the camelCase key. */
  label: string;
  /** One line on what this setting actually changes. */
  help: string;
  /** Shown beside the value so bare numbers carry their scale. */
  unit?: string;
  /** Collapsed behind an "Advanced" disclosure, within its own group. */
  advanced?: boolean;
  /** Hide this field unless the field at `path` currently equals `equals`. */
  showIf?: { path: string; equals: JsonValue };
  /** A finite value domain — renders a dropdown with these labels. */
  options?: { value: string; label: string }[];
  /** Widget override for values the generic type-based branches get wrong. */
  kind?: 'color' | 'keyId';
}

const LAYER_MODES = [
  { value: 'hold', label: 'Hold — shown only while the key is held' },
  { value: 'toggle', label: 'Long press — press again to go back' },
  { value: 'double-tap', label: 'Double tap — tap again to go back' },
];

/**
 * Layer-toggle keys config.ts accepts, spelled as the lowercase KeyId names
 * resolveKeyCode() looks up in KEY_NAMES (src/native/keyboard.ts). Deliberately
 * NOT derived from `keyNames` — that is the uppercase KEY constant map
 * (RIGHTALT, RMETA), and writing one of those into config.ts makes
 * resolveKeyCode throw "unknown key name" at layer-toggle time.
 */
const KEY_ID_OPTIONS = [
  { value: 'ralt', label: 'Right Option (⌥)' },
  { value: 'rmeta', label: 'Right Command (⌘)' },
  { value: 'rctrl', label: 'Right Control (⌃)' },
  { value: 'rshift', label: 'Right Shift (⇧)' },
  { value: 'lalt', label: 'Left Option (⌥)' },
  { value: 'lmeta', label: 'Left Command (⌘)' },
  { value: 'f12', label: 'F12' },
  { value: 'esc', label: 'Escape' },
  { value: 'space', label: 'Space' },
];

/**
 * Every editable field, keyed by its dotted path into config.ts. Prose is
 * rewritten from config.blueprint.ts's comments for someone who isn't reading
 * the source — a field with no entry here falls back to the humanized key.
 */
const FIELD_META: Record<string, FieldMeta> = {
  // ── Display ──
  'DISPLAY.dimSecs': { label: 'Dim after idle', help: 'Seconds without a touch before the bar dims.', unit: 's' },
  'DISPLAY.offSecs': { label: 'Turn screen off', help: 'Seconds of idle after dimming before the bar turns off completely.', unit: 's' },
  'DISPLAY.pixelShiftSecs': { label: 'Pixel shift interval', help: 'Seconds between nudging the image up one pixel so it does not burn in. 0 stops the shifting.', unit: 's', advanced: true },
  'DISPLAY.activeBrightness': {
    label: 'Brightness when in use',
    help: 'Full is brightest. At Half or Off, idle dimming does nothing — dimming already sets level 1.',
    options: [{ value: '0', label: 'Off' }, { value: '1', label: 'Half' }, { value: '2', label: 'Full' }],
  },
  'DISPLAY.flushFps': { label: 'Frame rate', help: 'How often the bar redraws. Lower saves power but looks less smooth.', unit: 'fps', advanced: true },
  'DISPLAY.partialFlush': { label: 'Partial refresh (unstable)', help: 'Only redraw the parts that changed. Saves power, but is not finished — leave it off unless you are debugging.', advanced: true },

  // ── On-screen Esc key ──
  'ESC_KEY.minWidth': { label: 'Bar width needed to show Esc', help: 'Touch Bars at least this wide (px) get an on-screen Esc key. 2170 is the wide model, 0 always shows it, Infinity never does.', unit: 'px' },
  'ESC_KEY.onLayers': {
    label: 'Show Esc',
    help: 'Where the Esc key appears on wide Touch Bars.',
    options: [
      { value: 'all', label: 'On every layer, fixed at the far left' },
      { value: 'fn', label: 'Only inside the Fn-key layer' },
    ],
  },
  'ESC_KEY.width': { label: 'Esc key width', help: 'Space reserved at the far left for the Esc key.', unit: 'px', showIf: { path: 'ESC_KEY.onLayers', equals: 'all' } },
  'ESC_KEY.gap': { label: 'Gap after Esc', help: 'Space between the Esc key and the rest of the bar.', unit: 'px', showIf: { path: 'ESC_KEY.onLayers', equals: 'all' } },

  // ── Sleep / wake ──
  'SLEEP.enabled': { label: 'Handle sleep and wake', help: 'Turns the bar off before the computer sleeps and brings it back afterwards. Leave this on unless the bar stays stuck on.' },
  'SLEEP.cardWaitSecs': { label: 'Startup wait', help: 'Seconds to wait for the bar to appear at startup and after waking. Raise it if the bar comes back blank.', unit: 's', advanced: true },

  // ── Layer transitions ──
  'LAYER_TRANSITION.outDurationMs': { label: 'Leave animation', help: 'How long a layer takes to slide away.', unit: 'ms' },
  'LAYER_TRANSITION.inDurationMs': { label: 'Enter animation', help: 'How long the next layer takes to slide in. Longer feels calmer.', unit: 'ms' },

  // ── Focused-window detection ──
  'ACTIVE_WINDOW.backend': {
    label: 'Detect the focused app with',
    help: 'Usually best left on automatic. Pick a specific one only if the wrong app is being detected.',
    options: [
      { value: 'auto', label: 'Detect automatically' },
      { value: 'hyprland', label: 'Hyprland' },
      { value: 'niri', label: 'niri' },
      { value: 'gnome', label: 'GNOME' },
      { value: 'plasma', label: 'KDE Plasma' },
      { value: 'xorg', label: 'Plain X11' },
    ],
  },

  // ── Screenshot ──
  'SCREENSHOT.keys': { label: 'Screenshot shortcut', help: 'Hold all of these together, comma-separated — e.g. ctrl, alt, s. Saves a picture of the Touch Bar.' },

  // ── Panels ──
  'DOLPHIN.maxPlaces': { label: 'Places shown', help: 'How many favourite folders appear as quick-jump chips in the Files panel.' },
  'DOLPHIN.pollMs': { label: 'Check for changes every', help: 'How often the Files panel looks for folder activity. Shorter feels more responsive but uses more power.', unit: 'ms', advanced: true },
  'KONSOLE.pollMs': { label: 'Check for changes every', help: 'How often the Terminal panel syncs tabs and sessions. Shorter feels more responsive but uses more power.', unit: 'ms', advanced: true },
  'SYSTEMBAR.statsPollMs': { label: 'Refresh stats every', help: 'How often the CPU, memory and network figures update. Every refresh redraws the bar.', unit: 'ms' },
  'CAVA.bars': { label: 'Number of bars', help: 'How many bars the audio visualizer draws. More is more detailed and slightly more work.' },
  'CAVA.framerate': { label: 'Animation speed', help: 'How often the audio bars move. 10 is cheapest, 30 is smoothest.', unit: 'fps' },

  // ── Dock ──
  'DOCK.iconSize': { label: 'Icon size', help: 'How large each app icon is drawn.', unit: 'px' },
  'DOCK.slot': { label: 'Tap target size', help: 'The square area around each icon that responds to a tap. Bigger is easier to hit but takes more room.', unit: 'px' },
  'DOCK.gap': { label: 'Gap between icons', help: 'Empty space between neighbouring icons.', unit: 'px' },
  'DOCK.lift': { label: 'Press animation', help: 'How far an icon rises while you hold it.', unit: 'px', advanced: true },
  'DOCK.icons.theme': { label: 'Icon theme', help: 'Where app icons are looked up. Automatic follows your desktop settings.' },
  'DOCK.panel': { label: 'Panel background', help: 'The strip the icons sit on.' },
  'DOCK.indicator': { label: 'Running-app dot', help: 'The dot that marks which app you are currently in.' },
  'DOCK.shortcut': { label: 'Opening the dock', help: 'How the dock layer is summoned and dismissed.' },
  'DOCK.panel.color': { label: 'Panel colour', help: 'The background behind the dock icons.', kind: 'color' },
  'DOCK.panel.radius': { label: 'Corner roundness', help: 'How rounded the dock panel corners are.', unit: 'px', advanced: true },
  'DOCK.panel.padX': { label: 'Padding, left and right', help: 'Empty space inside the panel on each side.', unit: 'px', advanced: true },
  'DOCK.panel.padY': { label: 'Padding, top and bottom', help: 'Empty space inside the panel above and below the icons.', unit: 'px', advanced: true },
  'DOCK.indicator.color': { label: 'Running dot colour', help: 'Colour of the dot under the icon of the app you are currently in.', kind: 'color' },
  'DOCK.indicator.size': { label: 'Running dot size', help: 'Diameter of that dot. Set to 0 to hide it.', unit: 'px' },
  'DOCK.shortcut.key': { label: 'Keyboard shortcut', help: 'Which key opens and closes the dock.', kind: 'keyId' },
  'DOCK.shortcut.mode': { label: 'How the shortcut works', help: 'What it takes to bring the dock up.', options: LAYER_MODES },
  'DOCK.shortcut.longMs': { label: 'Long press duration', help: 'How long to hold before it counts as a long press.', unit: 'ms', showIf: { path: 'DOCK.shortcut.mode', equals: 'toggle' } },
  'DOCK.shortcut.doubleMs': { label: 'Double tap gap', help: 'The longest gap between the two taps that still counts as a double tap.', unit: 'ms', showIf: { path: 'DOCK.shortcut.mode', equals: 'double-tap' } },

  // ── Dock apps (one entry per app in the list below) ──
  'DOCK.apps[].id': { label: 'ID', help: 'Internal identifier. Leave it alone unless you know why you need to change it.', advanced: true },
  'DOCK.apps[].label': { label: 'Name', help: 'Shown in the preview above. Not drawn on the bar itself.' },
  'DOCK.apps[].iconName': { label: 'Icon name', help: 'The name your desktop files this app’s icon under, usually taken from its launcher entry. Leave blank to use the fallback picture and colour instead.' },
  'DOCK.apps[].color': { label: 'Fallback colour', help: 'Used only when the icon name above finds no icon.', kind: 'color' },
  'DOCK.apps[].command': { label: 'Command to launch', help: 'What runs when you tap this icon.' },
  'DOCK.apps[].args': { label: 'Extra arguments', help: 'Comma-separated arguments passed to the command, e.g. https://github.com. Leave blank for none.' },
  'DOCK.apps[].matchClass': { label: 'Counts as open when', help: 'A window whose name contains any of these marks the app as running, which lights its dot. Leave blank to never show the dot.' },

  // ── Fn-key layer ──
  'FN_LAYER.mode': { label: 'How Fn works', help: 'What it takes to reach the F1–F12 layer.', options: LAYER_MODES },
  'FN_LAYER.longMs': { label: 'Long press duration', help: 'How long to hold before it counts as a long press.', unit: 'ms', showIf: { path: 'FN_LAYER.mode', equals: 'toggle' } },
  'FN_LAYER.doubleMs': { label: 'Double tap gap', help: 'The longest gap between the two taps that still counts as a double tap.', unit: 'ms', showIf: { path: 'FN_LAYER.mode', equals: 'double-tap' } },
  'FN_KEYS.extra[].label': { label: 'Label', help: 'Drawn on the key in the Fn layer.' },
};

function isPlainObject(v: JsonValue): v is Record<string, JsonValue> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function humanize(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
}

function keyNameFor(code: number): string {
  return codeToKeyName[code] ?? String(code);
}

function setPath(path: string[], value: JsonValue): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = state;
  for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
  obj[path[path.length - 1]] = value;
}

/** Reads a dotted config path out of state, for the showIf conditions. */
function getPath(dotted: string): JsonValue | undefined {
  let cur: JsonValue | undefined = state;
  for (const key of dotted.split('.')) {
    if (!isPlainObject(cur as JsonValue)) return undefined;
    cur = (cur as Record<string, JsonValue>)[key];
  }
  return cur;
}

/** Picking the same app twice, or adding two unrenamed "custom" apps, would
 *  otherwise both land on the same slug — two dock entries sharing an id
 *  both write out as literal duplicates (and break React's key uniqueness
 *  on the real Touch Bar). Append -2, -3, ... until it's actually unique. */
function uniqueAppId(base: string, existing: Record<string, JsonValue>[]): string {
  const taken = new Set(existing.map(a => a.id as string));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function markDirty(): void {
  const status = document.getElementById('status')!;
  status.textContent = 'Unsaved changes';
  status.className = '';
  // Restart applies the state that was last saved — a fresh edit makes it
  // stale, so take the button away until the next successful save.
  document.getElementById('restart-btn')!.style.display = 'none';
  refreshDockPreview();
  applyVisibility();
}

let dockPreviewTimer = 0;

function refreshDockPreview(): void {
  const dock = state.DOCK;
  if (!dockPreviewEl || dock === undefined || !isPlainObject(dock)) return;
  // Every icon resolves back through the main process (fs lookups); trail-
  // debounce so holding a key in a dock field doesn't re-resolve the dock on
  // each keystroke.
  window.clearTimeout(dockPreviewTimer);
  dockPreviewTimer = window.setTimeout(() => {
    void renderDockPreview(dockPreviewEl!, dock);
  }, 120);
}

/**
 * Shows or hides each row whose FIELD_META says it only applies to some other
 * field's value. Rows are toggled in place rather than re-rendered, so an open
 * "Advanced" disclosure, focus and caret position all survive the change that
 * triggered it.
 */
function applyVisibility(): void {
  for (const row of document.querySelectorAll<HTMLElement>('.field-row[data-path]')) {
    const showIf = FIELD_META[row.dataset.path ?? '']?.showIf;
    if (!showIf) continue;
    row.hidden = getPath(showIf.path) !== showIf.equals;
  }
}

/**
 * Moves every advanced row into a native <details> disclosure, one per
 * containing group. Working per-container (rather than one block per section)
 * keeps nested fields under their own legend — "Panel padding" stays inside
 * "Panel" instead of being lifted to a section-level Advanced.
 */
function collectAdvanced(panel: HTMLElement): void {
  const containers = new Set<HTMLElement>();
  for (const row of panel.querySelectorAll<HTMLElement>('.field-row[data-advanced]')) {
    if (row.parentElement) containers.add(row.parentElement);
  }
  for (const container of containers) {
    const rows = [...container.querySelectorAll<HTMLElement>(':scope > .field-row[data-advanced]')];
    if (rows.length === 0) continue;
    const details = document.createElement('details');
    details.className = 'advanced';
    const summary = document.createElement('summary');
    summary.textContent = 'Advanced';
    details.appendChild(summary);
    for (const row of rows) {
      row.removeAttribute('data-advanced');
      details.appendChild(row);
    }
    container.appendChild(details);
  }
}

let dockPreviewEl: HTMLElement | null = null;

/** The letter tile shown when an app has no icon file (or its file is dead).
 *  Shared by the no-icon branch and img.onerror so both fall back identically. */
function monoTile(app: Record<string, JsonValue>): HTMLElement {
  const mono = document.createElement('div');
  mono.className = 'tb-icon-mono';
  mono.style.background = typeof app.color === 'string' ? app.color : '#7dd3fc';
  const label = typeof app.label === 'string' ? app.label.trim() : '';
  mono.textContent = (label.charAt(0) || '?').toUpperCase();
  return mono;
}

/**
 * Renders the Dock's pinned apps in the Touch Bar's true 2008:60 aspect
 * ratio, using the live config values (panel color/radius, icon size, gap,
 * indicator color/size) — every dimension here is a percentage derived from
 * the real hardware dimensions, so this is a proportional live rendering of
 * the current settings, not a rough mockup.
 */
async function renderDockPreview(container: HTMLElement, dock: Record<string, JsonValue>): Promise<void> {
  try {
    const apps = (dock.apps as Record<string, JsonValue>[] | undefined) ?? [];
    const panel = isPlainObject(dock.panel) ? dock.panel : {};
    const indicator = isPlainObject(dock.indicator) ? dock.indicator : {};
    const iconSize = typeof dock.iconSize === 'number' ? dock.iconSize : 50;
    const gap = typeof dock.gap === 'number' ? dock.gap : 14;
    const indicatorSize = typeof indicator.size === 'number' ? indicator.size : 5;

    container.style.background = typeof panel.color === 'string' ? panel.color : '#1c1f26';
    const radiusPx = typeof panel.radius === 'number' ? panel.radius : 20;
    container.style.borderRadius = `${Math.min(16, radiusPx / 3)}px`;
    container.style.gap = `${(gap / 2008) * 100}%`;

    // Apply whatever theme is currently picked (saved or not) before resolving
    // any icon — resolveIcon's main-process side otherwise has no idea a theme
    // was ever chosen, see icon:setTheme's own comment in main.ts.
    const icons = isPlainObject(dock.icons) ? dock.icons : {};
    const theme = typeof icons.theme === 'string' ? icons.theme : null;
    await window.configApi.setIconTheme(theme);

    const resolved = await Promise.all(apps.map(async (a, i) => {
      const iconName = typeof a.iconName === 'string' ? a.iconName : undefined;
      let url: string | null = null;
      if (iconName) {
        // One dead icon must not take the whole preview down with it.
        try { url = await window.configApi.resolveIcon(iconName); } catch { url = null; }
      }
      return { app: a, url, showIndicator: i === 0 };
    }));

    container.innerHTML = '';
    if (resolved.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'tb-preview-empty';
      empty.textContent = 'No pinned apps yet';
      container.appendChild(empty);
      return;
    }

    for (const { app, url, showIndicator } of resolved) {
      const wrap = document.createElement('div');
      wrap.className = 'tb-icon-wrap';

      const shape = document.createElement('div');
      shape.className = 'tb-icon-shape';
      shape.style.height = `${(iconSize / 60) * 100}%`;
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = typeof app.label === 'string' ? app.label : '';
        // A theme switch or icon removal can leave a dead URL — swap to the
        // letter tile instead of parking a broken-image glyph in the preview.
        img.onerror = () => shape.replaceChildren(monoTile(app));
        shape.appendChild(img);
      } else {
        shape.appendChild(monoTile(app));
      }
      wrap.appendChild(shape);

      // Every icon reserves the same dot space, visible or not, so icons stay
      // vertically aligned regardless of which app happens to show one.
      const dot = document.createElement('span');
      dot.className = 'tb-indicator';
      dot.style.width = `${(indicatorSize / 60) * 100}%`;
      dot.style.height = dot.style.width;
      dot.style.background = showIndicator && typeof indicator.color === 'string' ? indicator.color : 'transparent';
      dot.style.boxShadow = showIndicator ? '' : 'none';
      wrap.appendChild(dot);

      container.appendChild(wrap);
    }
  } catch {
    container.innerHTML = '';
    const note = document.createElement('span');
    note.className = 'tb-preview-empty';
    note.textContent = 'Preview unavailable';
    container.appendChild(note);
  }
}

function wireWindowControls(): void {
  // onclick assignment (not addEventListener) so a re-run of main() can never
  // stack a second handler onto the same button.
  const wire = (id: string, fn: () => void): void => {
    document.getElementById(id)!.onclick = fn;
  };
  wire('win-minimize', () => window.windowApi.minimize());
  wire('win-maximize', () => window.windowApi.toggleMaximize());
  wire('win-close', () => window.windowApi.close());
}

async function main(): Promise<void> {
  const status = document.getElementById('status')!;
  status.textContent = 'Loading…';
  status.className = '';
  try {
    const meta = await window.configApi.meta();
    iconChoices = meta.iconChoices;
    domCodeToKeyName = meta.domCodeToKeyName;
    keyNames = meta.keyNames;
    codeToKeyName = {};
    for (const [name, code] of Object.entries(keyNames)) codeToKeyName[code] = name;

    const res = await window.configApi.read();
    if (!res.repoFound) return showEmptyState();
    if (res.error) return showError(res.error);
    state = JSON.parse(JSON.stringify(res.data ?? {}));

    // A repo whose config.ts parses but carries none of the sections this
    // editor knows would otherwise draw a blank form — call it out instead.
    if (!SECTION_ORDER.some(n => state[n] !== undefined)) return showNoSettingsState();

    // showEmptyState()/showError() hide the search box — put it back when a
    // re-run (e.g. after a successful locate) actually renders sections.
    (document.getElementById('search-wrap') as HTMLElement).style.display = '';

    buildNav();
    renderAllSections();
    showTab(SECTION_ORDER.find(n => state[n] !== undefined) ?? SECTION_ORDER[0]);
    wireTopbar();
    wireSearch();
    clearStatus();
  } catch (e) {
    showError(`Failed to talk to the config editor: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function clearStatus(): void {
  const status = document.getElementById('status');
  if (status) { status.textContent = ''; status.className = ''; }
}

function showEmptyState(): void {
  document.getElementById('nav')!.innerHTML = '';
  (document.getElementById('search-wrap') as HTMLElement).style.display = 'none';
  clearStatus();
  document.getElementById('content')!.innerHTML =
    '<div class="empty-state">Couldn\'t find linux-touchbar-control-center at the default install path.'
    + '<br/><button id="locate-btn">Locate folder…</button></div>';
  // onclick (not addEventListener) — main() re-runs after a successful locate
  // and must not stack a second handler onto this fresh button.
  document.getElementById('locate-btn')!.onclick = (): void => {
    void window.configApi.locate().then(() => main());
  };
}

function showNoSettingsState(): void {
  document.getElementById('nav')!.innerHTML = '';
  (document.getElementById('search-wrap') as HTMLElement).style.display = 'none';
  clearStatus();
  document.getElementById('content')!.innerHTML =
    '<div class="empty-state">config.ts parses, but it has none of the sections this editor knows.<br/>'
    + '<code>config.blueprint.ts</code> at the located repo is the reference for the expected shape.</div>';
}

function showError(msg: string): void {
  document.getElementById('nav')!.innerHTML = '';
  (document.getElementById('search-wrap') as HTMLElement).style.display = 'none';
  clearStatus();
  document.getElementById('content')!.innerHTML =
    `<div class="empty-state">Couldn't read config.ts:<br/><code>${escapeHtml(msg)}</code></div>`;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function buildNav(): void {
  const nav = document.getElementById('nav')!;
  nav.innerHTML = '';
  for (const group of NAV_GROUPS) {
    const sectionsPresent = group.sections.filter(name => state[name] !== undefined);
    if (sectionsPresent.length === 0) continue;

    const groupEl = document.createElement('div');
    groupEl.className = 'nav-group';
    const groupLabel = document.createElement('div');
    groupLabel.className = 'nav-group-label';
    groupLabel.textContent = group.label;
    groupEl.appendChild(groupLabel);

    for (const name of sectionsPresent) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-item';
      btn.textContent = SECTION_LABELS[name];
      btn.dataset.section = name;
      btn.addEventListener('click', () => showTab(name));
      groupEl.appendChild(btn);
    }
    nav.appendChild(groupEl);
  }
}

let searchWired = false;

function wireSearch(): void {
  // The input lives in index.html and survives a main() re-run, so one
  // listener is enough; stacking a second would double-filter every keystroke.
  if (searchWired) return;
  searchWired = true;

  const input = document.getElementById('search-input') as HTMLInputElement;
  const nav = document.getElementById('nav')!;
  let empty = nav.querySelector<HTMLElement>('.search-empty');
  if (!empty) {
    empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.textContent = 'No settings match that search.';
    empty.hidden = true;
    // Inside the scrolling nav, so it stays put as the groups above it hide.
    nav.appendChild(empty);
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let anyMatch = q.length === 0;
    document.querySelectorAll<HTMLElement>('.nav-item').forEach(btn => {
      // dataset.search carries the section's title plus every field label and
      // help line, so "brightness" finds the section that owns the field.
      const haystack = btn.dataset.search ?? btn.textContent?.toLowerCase() ?? '';
      const matches = q.length === 0 || haystack.includes(q);
      btn.classList.toggle('hidden', !matches);
      if (matches) anyMatch = true;
    });
    document.querySelectorAll<HTMLElement>('.nav-group').forEach(group => {
      const anyVisible = [...group.querySelectorAll('.nav-item')]
        .some(el => !el.classList.contains('hidden'));
      group.style.display = anyVisible ? '' : 'none';
    });
    empty.hidden = anyMatch;
  });
}

function showTab(name: SectionName): void {
  document.querySelectorAll<HTMLElement>('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.section === name);
  });
  document.querySelectorAll('.section-panel').forEach(p => {
    p.classList.toggle('active', p.id === `panel-${name}`);
  });
  document.getElementById('content')!.classList.toggle('wide', name === 'DOCK');
}

function renderAllSections(): void {
  const content = document.getElementById('content')!;
  content.innerHTML = '';
  for (const name of SECTION_ORDER) {
    if (state[name] === undefined) continue;
    const panel = document.createElement('div');
    panel.className = 'section-panel';
    panel.id = `panel-${name}`;

    const header = document.createElement('div');
    header.className = 'section-header';
    const title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = SECTION_LABELS[name];
    const desc = document.createElement('p');
    desc.className = 'section-desc';
    desc.textContent = SECTION_DESCRIPTIONS[name];
    header.append(title, desc);
    panel.appendChild(header);

    content.appendChild(panel);
    renderSection(name, panel);
    collectAdvanced(panel);
    applyVisibility();
    indexSectionForSearch(name, panel);
  }
}

/** Lets the sidebar search reach fields, not just the section names. */
function indexSectionForSearch(name: SectionName, panel: HTMLElement): void {
  const btn = document.querySelector<HTMLElement>(`.nav-item[data-section="${name}"]`);
  if (!btn) return;
  const parts = [SECTION_LABELS[name], SECTION_DESCRIPTIONS[name]];
  for (const row of panel.querySelectorAll('.field-row')) {
    parts.push(row.querySelector('label')?.textContent ?? '');
    parts.push(row.querySelector('.field-help')?.textContent ?? '');
  }
  btn.dataset.search = parts.join(' ').toLowerCase();
}

function renderSection(name: SectionName, panel: HTMLElement): void {
  const value = state[name];
  if (value === undefined || !isPlainObject(value)) return;
  switch (name) {
    case 'DOCK': return renderDock(panel, value);
    case 'DEFAULT_BROWSER_KEYS': return renderKeymap(panel, name, value, BROWSER_ACTIONS);
    case 'DEFAULT_VSCODE_KEYS': return renderKeymap(panel, name, value, VSCODE_ACTIONS);
    case 'BROWSER_KEY_OVERRIDES': return renderOverrides(panel, name, value, BROWSER_ACTIONS);
    case 'VSCODE_KEY_OVERRIDES': return renderOverrides(panel, name, value, VSCODE_ACTIONS);
    case 'FN_KEYS': return renderFnKeys(panel, value);
    default: return renderGenericObject(panel, value, [name]);
  }
}

let controlSeq = 0;

/**
 * One settings row: a label plus its help text on the left, the control (and
 * its unit) on the right. The control always gets a real id so the <label for>
 * and aria-describedby wiring is free, and `data-path` lets applyVisibility()
 * find the row again without keeping a registry.
 */
function buildFieldRow(opts: {
  label: string;
  help?: string;
  unit?: string;
  path?: string;
  advanced?: boolean;
  control: HTMLElement;
  extras?: HTMLElement[];
}): HTMLElement {
  const row = document.createElement('div');
  row.className = 'field-row';
  if (opts.path) row.dataset.path = opts.path;
  if (opts.advanced) row.dataset.advanced = 'true';

  const controlId = `field-${++controlSeq}`;
  opts.control.id = controlId;

  const labels = document.createElement('div');
  labels.className = 'field-labels';
  const label = document.createElement('label');
  label.htmlFor = controlId;
  label.textContent = opts.label;
  labels.appendChild(label);

  if (opts.help) {
    const help = document.createElement('p');
    help.className = 'field-help';
    help.id = `${controlId}-help`;
    help.textContent = opts.help;
    labels.appendChild(help);
    opts.control.setAttribute('aria-describedby', help.id);
  }
  row.appendChild(labels);

  const holder = document.createElement('div');
  holder.className = 'field-control';
  holder.appendChild(opts.control);
  for (const extra of opts.extras ?? []) holder.appendChild(extra);

  if (opts.unit) {
    const unit = document.createElement('span');
    unit.className = 'field-unit';
    unit.textContent = opts.unit;
    unit.setAttribute('aria-hidden', 'true');
    holder.appendChild(unit);
  }

  row.appendChild(holder);
  return row;
}

function selectControl(
  options: { value: string; label: string }[],
  current: JsonValue,
  onChange: (raw: string) => void,
): HTMLSelectElement {
  const select = document.createElement('select');
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (String(current) === opt.value) o.selected = true;
    select.appendChild(o);
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function renderGenericObject(container: HTMLElement, obj: Record<string, JsonValue>, path: string[]): void {
  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = [...path, key];
    const pathStr = fieldPath.join('.');
    const meta = FIELD_META[pathStr];

    if (isPlainObject(value)) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = meta?.label ?? humanize(key);
      fieldset.appendChild(legend);
      container.appendChild(fieldset);
      renderGenericObject(fieldset, value, fieldPath);
      continue;
    }

    const commit = (v: JsonValue): void => { setPath(fieldPath, v); markDirty(); };
    let control: HTMLInputElement | HTMLSelectElement;
    const extras: HTMLElement[] = [];

    if (meta?.kind === 'keyId') {
      const options = typeof value === 'string' && !KEY_ID_OPTIONS.some(o => o.value === value)
        ? [...KEY_ID_OPTIONS, { value, label: `${value} (not a known key)` }]
        : KEY_ID_OPTIONS;
      control = selectControl(options, value, raw => commit(raw));
    } else if (meta?.kind === 'color') {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#7dd3fc';
      input.addEventListener('change', () => commit(input.value));
      control = input;
    } else if (meta?.options) {
      control = selectControl(meta.options, value, raw => commit(typeof value === 'number' ? Number(raw) : raw));
    } else if (typeof value === 'boolean') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = value;
      input.addEventListener('change', () => commit(input.checked));
      control = input;
    } else if (typeof value === 'number') {
      const input = document.createElement('input');
      input.type = 'text';
      const asText = value === Infinity ? 'Infinity' : String(value);
      input.value = asText;

      // Built without an id — the row below assigns the input its id, which
      // this node then copies so aria links stay unique per row (see the
      // post-build block in renderGenericObject).
      const error = document.createElement('p');
      error.className = 'field-error';
      error.hidden = true;

      const markInvalid = (): void => {
        input.setAttribute('aria-invalid', 'true');
        error.textContent = 'Not a number — enter a number, or “Infinity” to never.';
        error.hidden = false;
        const errorId = `${input.id}-error`;
        input.setAttribute('aria-describedby',
          [input.getAttribute('aria-describedby'), errorId].filter(Boolean).join(' '));
      };

      input.addEventListener('change', () => {
        const raw = input.value.trim();
        const n = raw.toLowerCase() === 'infinity' ? Infinity : Number(raw);
        // Empty used to commit 0 silently (Number('') === 0) — treat it as
        // the same error as a non-number and revert on blur with the rest.
        if (raw === '' || Number.isNaN(n)) { markInvalid(); return; }
        input.removeAttribute('aria-invalid');
        error.hidden = true;
        commit(n);
      });
      input.addEventListener('blur', () => {
        if (input.getAttribute('aria-invalid') !== 'true') return;
        input.value = asText;
        input.removeAttribute('aria-invalid');
        error.hidden = true;
      });
      extras.push(error);
      control = input;
    } else if (Array.isArray(value)) {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = value.join(', ');
      input.addEventListener('change', () => {
        commit(input.value.split(',').map(s => s.trim()).filter(Boolean));
      });
      control = input;
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = String(value);
      input.addEventListener('change', () => commit(input.value));
      control = input;
    }

    const row = buildFieldRow({
      path: pathStr,
      label: meta?.label ?? humanize(key),
      help: meta?.help,
      unit: meta?.unit,
      advanced: meta?.advanced,
      control,
      extras,
    });
    // Number rows push a `.field-error` that was built before the row assigned
    // the input its real id — copy the id back so it never collides across
    // rows (a shared id would break aria-describedby association).
    if (typeof value === 'number') {
      const err = row.querySelector<HTMLElement>('.field-error');
      if (err) err.id = `${control.id}-error`;
    }
    container.appendChild(row);
  }
}

// ── App picker ───────────────────────────────────────────────────────────────

/** Lets the user pick from actually-installed apps (parsed from .desktop
 *  entries) instead of hand-typing a command and icon name — the same
 *  source every launcher/dock on the desktop reads from. */
async function openAppPicker(
  onPick: (name: string, command: string, args: string[], icon: string | null) => void,
): Promise<void> {
  let appsFailed = false;
  if (!desktopAppsCache) {
    try {
      desktopAppsCache = await window.configApi.listApps();
    } catch {
      desktopAppsCache = [];
      appsFailed = true;
    }
  }
  const apps = desktopAppsCache;
  // Restored on close so the keyboard user lands back where they opened from.
  const previouslyFocused = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  const overlay = document.createElement('div');
  overlay.className = 'picker-overlay';
  const panel = document.createElement('div');
  panel.className = 'picker-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Choose an app to add to the dock');
  overlay.appendChild(panel);

  function close(): void {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keydown', onTab);
    previouslyFocused?.focus();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
  // Keep Tab inside the picker so keyboard focus can't wander behind the
  // overlay; at the edges it wraps to the far end of the panel instead.
  function onTab(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;
    const focusables = [...panel.querySelectorAll<HTMLElement>(
      'button, input, [tabindex]:not([tabindex="-1"])',
    )];
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (!panel.contains(active)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Search installed apps…';
  search.className = 'picker-search';
  panel.appendChild(search);

  const list = document.createElement('div');
  list.className = 'picker-list';
  panel.appendChild(list);

  function renderItems(query: string): void {
    list.innerHTML = '';
    const q = query.trim().toLowerCase();
    const filtered = q ? apps.filter(a => a.name.toLowerCase().includes(q)) : apps;
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'picker-empty';
      empty.textContent = appsFailed ? "Couldn't load installed apps." : 'No matching apps';
      list.appendChild(empty);
      return;
    }
    for (const a of filtered.slice(0, 300)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'picker-item';
      item.textContent = a.name;
      item.addEventListener('click', () => { onPick(a.name, a.command, a.args, a.icon); close(); });
      list.appendChild(item);
    }
  }
  renderItems('');
  search.addEventListener('input', () => renderItems(search.value));

  const customBtn = document.createElement('button');
  customBtn.type = 'button';
  customBtn.className = 'secondary picker-custom';
  customBtn.textContent = 'Add a custom app instead';
  customBtn.addEventListener('click', () => { onPick('New App', '', [], null); close(); });
  panel.appendChild(customBtn);

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.addEventListener('keydown', onTab);

  document.body.appendChild(overlay);
  search.focus();
}

// ── DOCK ─────────────────────────────────────────────────────────────────────

function renderDock(container: HTMLElement, dock: Record<string, JsonValue>): void {
  const previewWrap = document.createElement('div');
  previewWrap.className = 'tb-preview-wrap';
  const preview = document.createElement('div');
  preview.className = 'touchbar-preview';
  previewWrap.appendChild(preview);
  const caption = document.createElement('p');
  caption.className = 'tb-preview-caption';
  caption.textContent = 'Live preview — reflects the settings below as you change them';
  previewWrap.appendChild(caption);
  container.appendChild(previewWrap);
  dockPreviewEl = preview;
  void renderDockPreview(preview, dock);

  renderIconThemeField(container, dock);

  const scalarKeys = ['iconSize', 'slot', 'gap', 'lift', 'panel', 'indicator', 'shortcut'];
  const scalarPart: Record<string, JsonValue> = {};
  for (const k of scalarKeys) if (dock[k] !== undefined) scalarPart[k] = dock[k];
  renderGenericObject(container, scalarPart, ['DOCK']);

  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Apps';
  fieldset.appendChild(legend);
  container.appendChild(fieldset);

  const list = document.createElement('div');
  fieldset.appendChild(list);

  const apps = (dock.apps as Record<string, JsonValue>[] | undefined) ?? [];

  function renderList(): void {
    list.innerHTML = '';
    apps.forEach((appItem, idx) => list.appendChild(renderAppCard(appItem, idx, apps, renderList)));
  }
  renderList();

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add app';
  addBtn.className = 'secondary';
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => {
    void openAppPicker((name, command, argsList, icon) => {
      const id = uniqueAppId(
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'app',
        apps,
      );
      const newApp: Record<string, JsonValue> = {
        id, label: name, iconGlyph: iconChoices[0] ?? 'FaFolder', color: '#7dd3fc', command,
      };
      if (icon) newApp.iconName = icon;
      if (argsList.length > 0) newApp.args = argsList;
      apps.push(newApp);
      setPath(['DOCK', 'apps'], apps);
      markDirty();
      renderList();
    });
  });
  fieldset.appendChild(addBtn);
}

const AUTO_THEME = ''; // <select> value standing in for DOCK.icons.theme === null

/** DOCK.icons.theme picks which installed icon theme dock/app icons resolve
 *  from (null = auto-detect from kdeglobals/GTK settings, see appIcon.ts) —
 *  a select over actually-installed themes instead of free text, same
 *  reasoning as the app picker: offer what's really there, not what the
 *  user has to know to type. */
function renderIconThemeField(container: HTMLElement, dock: Record<string, JsonValue>): void {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Icons';
  fieldset.appendChild(legend);
  container.appendChild(fieldset);

  const select = document.createElement('select');
  const themeMeta = FIELD_META['DOCK.icons.theme'];
  fieldset.appendChild(buildFieldRow({
    path: 'DOCK.icons.theme',
    label: themeMeta.label,
    help: themeMeta.help,
    control: select,
  }));

  const icons = dock.icons as Record<string, JsonValue> | undefined;
  const current = (icons?.theme as string | null | undefined) ?? null;

  function populate(themes: string[]): void {
    select.innerHTML = '';
    // Keep a currently-set theme selectable even if it's no longer installed
    // (theme removed, or set on a different machine) — never silently swap
    // the user's choice out from under them just for opening the dropdown.
    const options = current !== null && !themes.includes(current)
      ? [AUTO_THEME, current, ...themes]
      : [AUTO_THEME, ...themes];
    for (const value of options) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value === AUTO_THEME ? 'Auto-detect' : value;
      opt.selected = value === AUTO_THEME ? current === null : value === current;
      select.appendChild(opt);
    }
  }

  populate(iconThemesCache ?? []);
  if (!iconThemesCache) {
    void window.configApi.listIconThemes().then(themes => {
      iconThemesCache = themes;
      populate(themes);
    }).catch(() => {
      // Keep Auto-detect as the working value; a broken theme lookup must not
      // take the whole dock panel down with it.
    });
  }

  select.addEventListener('change', () => {
    setPath(['DOCK', 'icons', 'theme'], select.value === AUTO_THEME ? null : select.value);
    markDirty();
  });
}

function renderAppCard(
  appItem: Record<string, JsonValue>,
  idx: number,
  apps: Record<string, JsonValue>[],
  onStructuralChange: () => void,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'app-card';

  const commitApp = (): void => { setPath(['DOCK', 'apps'], apps); markDirty(); };

  const header = document.createElement('div');
  header.className = 'app-card-header';

  const iconSelect = document.createElement('select');
  iconSelect.setAttribute('aria-label', 'Fallback icon, used when the icon name finds nothing');
  for (const choice of iconChoices) {
    const opt = document.createElement('option');
    opt.value = choice;
    opt.textContent = choice;
    if (choice === appItem.iconGlyph) opt.selected = true;
    iconSelect.appendChild(opt);
  }
  iconSelect.addEventListener('change', () => {
    appItem.iconGlyph = iconSelect.value;
    commitApp();
  });
  header.appendChild(iconSelect);

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.className = 'danger';
  removeBtn.type = 'button';
  removeBtn.addEventListener('click', () => {
    apps.splice(idx, 1);
    commitApp();
    onStructuralChange();
  });
  header.appendChild(removeBtn);
  card.appendChild(header);

  const appRow = (key: string, control: HTMLElement): void => {
    const meta = FIELD_META[`DOCK.apps[].${key}`];
    card.appendChild(buildFieldRow({
      path: `DOCK.apps[].${key}`,
      label: meta?.label ?? humanize(key),
      help: meta?.help,
      advanced: meta?.advanced,
      control,
    }));
  };

  appRow('id', smallTextInput((appItem.id as string) ?? '', v => { appItem.id = v; commitApp(); }));

  for (const key of ['label', 'iconName', 'command'] as const) {
    appRow(key, smallTextInput((appItem[key] as string) ?? '', v => { appItem[key] = v; commitApp(); }));
  }

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  const currentColor = (appItem.color as string | undefined) ?? '#7dd3fc';
  colorInput.value = /^#[0-9a-f]{6}$/i.test(currentColor) ? currentColor : '#7dd3fc';
  colorInput.addEventListener('change', () => { appItem.color = colorInput.value; commitApp(); });
  appRow('color', colorInput);

  for (const key of ['args', 'matchClass'] as const) {
    const arr = (appItem[key] as string[] | undefined) ?? [];
    appRow(key, smallTextInput(arr.join(', '), v => {
      const parsed = v.split(',').map(s => s.trim()).filter(Boolean);
      if (parsed.length) appItem[key] = parsed; else delete appItem[key];
      commitApp();
    }));
  }

  // Cards are rebuilt whenever the app list changes, so the panel-level
  // collectAdvanced pass in renderAllSections will not see this card's rows.
  collectAdvanced(card);
  return card;
}

function smallTextInput(value: string, onChange: (v: string) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

// ── Keymaps ──────────────────────────────────────────────────────────────────

function renderKeymap(
  container: HTMLElement,
  section: SectionName,
  keymap: Record<string, JsonValue>,
  actions: string[],
): void {
  for (const action of actions) {
    if (keymap[action] === undefined) continue;
    const codes = (keymap[action] as number[]).slice();
    container.appendChild(buildFieldRow({
      label: humanize(action),
      control: renderKeyCapture(codes, newCodes => {
        keymap[action] = newCodes;
        setPath([section, action], newCodes);
        markDirty();
      }, humanize(action)),
    }));
  }
}

function renderOverrides(
  container: HTMLElement,
  section: SectionName,
  overrides: Record<string, JsonValue>,
  actions: string[],
): void {
  const list = document.createElement('div');
  container.appendChild(list);

  function renderList(): void {
    list.innerHTML = '';
    for (const [windowClass, partial] of Object.entries(overrides)) {
      if (!isPlainObject(partial)) continue;
      list.appendChild(renderOverrideBlock(section, windowClass, partial, overrides, actions, renderList));
    }
  }
  renderList();

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = section === 'VSCODE_KEY_OVERRIDES' ? 'window name, e.g. codium' : 'window name, e.g. firefox';
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add override';
  addBtn.className = 'secondary';
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => {
    const windowClass = input.value.trim().toLowerCase();
    if (!windowClass || overrides[windowClass] !== undefined) return;
    overrides[windowClass] = {};
    setPath([section], overrides);
    markDirty();
    input.value = '';
    renderList();
  });
  container.appendChild(buildFieldRow({
    label: 'Add an override',
    help: 'Applies only to one specific window. Paste its window name, then set just the keys you want to change — everything else keeps the default above.',
    control: input,
    extras: [addBtn],
  }));
}

function renderOverrideBlock(
  section: SectionName,
  windowClass: string,
  partial: Record<string, JsonValue>,
  overrides: Record<string, JsonValue>,
  actions: string[],
  onStructuralChange: () => void,
): HTMLElement {
  const block = document.createElement('div');
  block.className = 'override-block';

  const header = document.createElement('div');
  header.className = 'override-block-header';
  const title = document.createElement('strong');
  title.textContent = windowClass;
  header.appendChild(title);
  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.className = 'danger';
  removeBtn.type = 'button';
  removeBtn.addEventListener('click', () => {
    delete overrides[windowClass];
    setPath([section], overrides);
    markDirty();
    onStructuralChange();
  });
  header.appendChild(removeBtn);
  block.appendChild(header);

  for (const action of actions) {
    const codes = ((partial[action] as number[] | undefined) ?? []).slice();
    block.appendChild(buildFieldRow({
      label: humanize(action),
      control: renderKeyCapture(codes, newCodes => {
        if (newCodes.length) partial[action] = newCodes; else delete partial[action];
        setPath([section], overrides);
        markDirty();
      }, humanize(action)),
    }));
  }

  return block;
}

// ── FN_KEYS ──────────────────────────────────────────────────────────────────

function renderFnKeys(container: HTMLElement, fnKeys: Record<string, JsonValue>): void {
  const list = document.createElement('div');
  container.appendChild(list);

  function extraArray(): Record<string, JsonValue>[] {
    return (fnKeys.extra as Record<string, JsonValue>[] | undefined) ?? [];
  }

  function renderList(): void {
    list.innerHTML = '';
    extraArray().forEach((entry, i) => {
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.value = (entry.label as string | undefined) ?? '';
      labelInput.placeholder = 'e.g. prt';
      labelInput.addEventListener('change', () => {
        entry.label = labelInput.value;
        setPath(['FN_KEYS', 'extra'], extraArray());
        markDirty();
      });

      const meta = FIELD_META['FN_KEYS.extra[].label'];
      const row = buildFieldRow({ label: meta.label, help: meta.help, control: labelInput });

      const codes = [entry.key as number];
      const capture = renderKeyCapture(codes, newCodes => {
        if (!newCodes.length) return;
        entry.key = newCodes[newCodes.length - 1];
        setPath(['FN_KEYS', 'extra'], extraArray());
        markDirty();
      }, 'this extra key');

      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.className = 'danger';
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', () => {
        extraArray().splice(i, 1);
        setPath(['FN_KEYS', 'extra'], extraArray());
        markDirty();
        renderList();
      });

      row.querySelector('.field-control')!.append(capture, removeBtn);
      list.appendChild(row);
    });
  }
  renderList();

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add key';
  addBtn.className = 'secondary';
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => {
    extraArray().push({ label: 'key', key: keyNames.ESC ?? 1 });
    setPath(['FN_KEYS', 'extra'], extraArray());
    markDirty();
    renderList();
  });
  container.appendChild(addBtn);
}

function renderKeyCapture(codes: number[], onChange: (codes: number[]) => void, name: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'key-capture';
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `Keyboard shortcut for ${name}`);

  const render = (): void => {
    el.textContent = codes.length ? codes.map(keyNameFor).join(' + ') : '(click to set)';
  };
  render();

  let listening = false;
  let captured: number[] = [];

  el.addEventListener('click', () => {
    listening = true;
    captured = [];
    el.classList.add('listening');
    el.textContent = 'Press keys… (Enter to confirm, Esc to cancel)';
    el.focus();
  });

  el.addEventListener('blur', () => {
    listening = false;
    el.classList.remove('listening');
    render();
  });

  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!listening) return;
    e.preventDefault();
    if (e.key === 'Escape') { listening = false; el.classList.remove('listening'); render(); return; }
    if (e.key === 'Enter') {
      listening = false;
      el.classList.remove('listening');
      if (captured.length) { codes.length = 0; codes.push(...captured); onChange(codes); }
      render();
      return;
    }
    const name = domCodeToKeyName[e.code];
    const code = name ? keyNames[name] : undefined;
    if (code !== undefined && !captured.includes(code)) {
      captured.push(code);
      el.textContent = captured.map(keyNameFor).join(' + ') + ' …';
    }
  });

  return el;
}

// ── Topbar ───────────────────────────────────────────────────────────────────

let topbarWired = false;

function wireTopbar(): void {
  // The buttons live in index.html and main() can re-run after a successful
  // locate — wiring them again would make one Save click fire two writes.
  if (topbarWired) return;
  topbarWired = true;

  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
  const restartBtn = document.getElementById('restart-btn') as HTMLButtonElement;
  const status = document.getElementById('status')!;

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      const res = await window.configApi.write(state);
      if (res.ok) {
        status.textContent = 'Saved';
        status.className = 'ok';
        restartBtn.style.display = '';
      } else {
        status.textContent = `Save failed: ${res.error}`;
        status.className = 'error';
      }
    } catch (e) {
      status.textContent = `Save failed: ${e instanceof Error ? e.message : String(e)}`;
      status.className = 'error';
    } finally {
      saveBtn.disabled = false;
    }
  });

  restartBtn.addEventListener('click', async () => {
    restartBtn.disabled = true;
    try {
      const res = await window.configApi.restart();
      status.textContent = res.ok ? res.message : `Restart failed: ${res.message}`;
      status.className = res.ok ? 'ok' : 'error';
      if (res.ok) restartBtn.style.display = 'none';
    } catch (e) {
      status.textContent = `Restart failed: ${e instanceof Error ? e.message : String(e)}`;
      status.className = 'error';
    } finally {
      restartBtn.disabled = false;
    }
  });
}

// Safety net for anything async that slips past the explicit catches — one
// readable status line instead of a silent rejection lost in the console.
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  const status = document.getElementById('status');
  if (!status) return;
  const reason = e.reason instanceof Error ? e.reason.message : String(e.reason ?? e);
  status.textContent = `Something went wrong: ${reason}`;
  status.className = 'error';
});

wireWindowControls();
main();

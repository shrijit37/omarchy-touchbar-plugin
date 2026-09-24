import { spawn } from 'child_process';
import type { DockApp } from '@/lib/utils/configLoader';
import { createLogger } from 'omarchy-touchbar';

const log = createLogger('dock');

/**
 * Launch a desktop app from the Touch Bar process.
 *
 * The control center runs as an unprivileged user service, inside the same
 * graphical session as the desktop — so a plain spawn already lands the app in
 * the user's session and inherits their D-Bus/Wayland environment. There is
 * deliberately no `runuser`/SUDO_USER path: it was unreachable (the unit has no
 * User= and install.sh never creates a root unit) and only added a way to lose
 * the session env.
 */
export function launch(command: string, args: string[] = []): void {
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.on('error', err => log.error('launch failed:', command, err.message));
  child.unref();
}

/** Same as {@link launch}, shaped for the dock's config-driven app entries. */
export function launchApp(app: DockApp): void {
  launch(app.command, app.args ?? []);
}

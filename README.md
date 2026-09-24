# Omarchy Touch Bar

Omarchy Touch Bar provides a React renderer for drawing directly to Linux
DRM/KMS displays using libdrm and Cairo. This repository includes a control
center that replaces the standard Touch Bar interface on T2 MacBooks running
Linux. It is packaged as an omarchy shell plugin and installable with
`omarchy plugin add`.

The control center provides:

- Function keys and an optional on-screen Escape key
- Media controls, volume and display brightness
- Application-aware controls for browsers, media players and file managers
- CPU, memory, temperature, network and battery information
- Audio visualization (cava), a Pomodoro timer and small games
- Automatic detach and re-attach during suspend and resume

## Installation

Omarchy Touch Bar replaces the existing Touch Bar interface. `tiny-dfr` and
`mac-touchbar-plus` must not run alongside it — the installer's purge phase
detects and removes exactly those two daemons and nothing else.

Install as an omarchy plugin (clones + validates, then run the installer once):

```sh
omarchy plugin add https://github.com/shrijit37/omarchy-touchbar-plugin --enable
~/.config/omarchy/plugins/io.github.shrijit37.omarchy-touchbar/install-omarchy.sh
```

On other Arch-based distributions, or on a compositor where you don't want the
plugin, run the installer directly from a checkout instead:

```sh
./install.sh install
```

The Bar Widget shows setup status and launches the installer when the daemon
isn't built yet. The installer:

- verifies that the Mac model has a T2 Touch Bar;
- installs the Arch build and runtime dependencies (only the ones missing — the
  package database is never refreshed and no system upgrade is run; if package
  resolution fails because the system is stale, run `omarchy update` first and
  then re-run the installer);
- removes conflicting Touch Bar daemons (only `tiny-dfr` / `mac-touchbar-plus`);
- installs the udev rules and required user groups;
- builds the source in the checkout, then deploys the built tree — including a
  full `node_modules` mirror and a real `omarchy-touchbar` vendor package — to
  `~/.local/share/omarchy-touchbar`, which is where the service, config editor
  and Bar Widget all run from (never from the checkout itself);
- builds the Touch Bar configuration GUI and adds it to the application menu;
- installs and starts `omarchy-touchbar.service` for the invoking user;
- cleans build-time `node_modules` out of the checkout and gates the install on
  `omarchy plugin validate`, so `omarchy plugin update` keeps working.

The installer targets Arch-family distributions (Omarchy included) and the
`t2linux` Touch Bar driver stack, seeding the matching environment/udev profile.
It accepts:

- `--yes, -y` — skip the interactive `yes` / `CONTINUE` / `PURGE` confirmations.

Command-line install (equivalent to the omarchy flow):

```sh
./install.sh install --yes
```

`./install.sh analyze` runs only the read-only detection pass (distribution,
session, hardware, driver stack, conflicting daemons, package transaction) and
changes nothing — useful to vet a machine before installing.

### Uninstall

Run the separate uninstaller from the plugin directory:

```sh
~/.config/omarchy/plugins/io.github.shrijit37.omarchy-touchbar/uninstall-omarchy.sh
```

It stops and removes the omarchy-touchbar user service (including the legacy
pre-rebrand `react-drm.service` unit), restores the firmware Touch Bar
interface, removes the udev rules and the config-editor launcher, and deletes
the installed copy at `~/.local/share/omarchy-touchbar`. The checkout/plugin
files, system packages and `video`/`input` group memberships are left
unchanged. Outside Omarchy, run `./uninstall.sh uninstall` directly.

### Service status

Check its status and log with:

```sh
systemctl --user status omarchy-touchbar.service
journalctl --user -u omarchy-touchbar.service -b
```

The service runs without root privileges. It attaches the Touch Bar when the
graphical session starts, restores the firmware interface when the session
ends and handles suspend and resume. The firmware function-key strip remains
available before login and after logout.

## Manual start

Or just run the dev script from the repository root — it stops the user
service (it holds the DRM card), builds the native addon if missing, syncs the
bar widget into the plugin clone, and launches the dev build with the red
"dev mode" blinker active (a blinking red border around the Touch Bar and a
blinking red dot on the desktop bar's Touch Bar pill):

```sh
./dev.sh
```

The blinker is dev-only: it is gated on `OMARCHY_TOUCHBAR_DEV_INDICATOR=1`, which
`dev.sh` sets and the installed service never does. The script removes its
dev-mode marker on exit, including on Ctrl-C.

To do the same by hand — stop the user service, then run the control center
from the repository checkout (development happens here, not in
`~/.local/share/omarchy-touchbar`; the installer removes the checkout's
`node_modules` after each install, so run `npm ci` first if there is none):

```sh
systemctl --user stop omarchy-touchbar.service
cd ~/.config/omarchy/plugins/io.github.shrijit37.omarchy-touchbar  # or your clone
npm ci
./dev.sh
```

`./dev.sh` is the development entrypoint and keeps hot reload enabled (it runs
`npm run dev` in the control-center workspace — there is no root `dev` script).
The installed systemd service uses the compiled production build instead.

## Browser preview (no Touch Bar / DRM hardware)

Touch Bar UI can be developed and previewed in an ordinary desktop browser —
no MacBook, no Touch Bar, no `/dev/dri` device and no root required. The
preview shows the *actual* pixels the native Cairo renderer draws (the same
renderer the physical Touch Bar uses), streamed over WebSocket to a
`<canvas>`. It is not a separate HTML/DOM re-implementation of the UI:

```
React → omarchy-touchbar renderer → Cairo → in-memory framebuffer
                                        ├─ production  → DRM/KMS → physical Touch Bar
                                        └─ development → WebSocket → browser <canvas>
```

**Dependencies**: the same native build dependencies as DRM mode (Node.js,
a C++ compiler and the libdrm/Cairo/librsvg/pango development headers — see
[Manual start](#manual-start)). A DRM device, root and Touch Bar
hardware are only needed to compile the native addon once, not to *run*
preview mode.

**Build** once from the repository root:

```sh
npm run build
```

**Run** — from `linux-touchbar-control-center`:

```sh
npm run dev            # real Touch Bar over DRM/KMS
npm run dev:preview    # browser preview instead (dev/tsx)
npm run start:preview  # browser preview instead (compiled production build)
```

`dev:preview` sets `OMARCHY_TOUCHBAR_BACKEND=preview`, which makes `createDisplay()`
construct a `PreviewDisplay` (an in-memory framebuffer wrapped by the same
`CairoRenderer` class the DRM path uses) instead of `DrmDisplay`, and starts a
small HTTP + WebSocket server. It prints:

```
[omarchy-touchbar] preview server running
  http://127.0.0.1:8787
```

**Open that URL** in a browser to see the Touch Bar. The canvas is the real
logical Touch Bar resolution (2008×60 by default — the same fallback size used
elsewhere in the project) and is scaled up with CSS for visibility;
scaling is nearest-neighbor so it stays pixel-accurate.

Backend selection follows the project's existing environment-variable
convention (alongside `OMARCHY_TOUCHBAR_DEVICE_PATH`, `OMARCHY_TOUCHBAR_PROFILE`, etc.):

| Variable                  | Values                     | Default | Meaning |
|----------------------------|-----------------------------|---------|---------|
| `OMARCHY_TOUCHBAR_BACKEND`        | `drm` \| `preview`          | `drm`   | Which display backend `createDisplay()` builds |
| `OMARCHY_TOUCHBAR_PREVIEW_PORT`   | port number                 | `8787`  | Preview HTTP/WebSocket port |

### Input mapping

Mouse and touch on the preview page simulate Touch Bar touch input:

| Browser event                                | Touch Bar equivalent |
|-----------------------------------------------|-----------------------|
| `mousedown` / `touchstart`                    | finger down |
| `mousemove` while pressed / `touchmove`       | finger drag |
| `mouseup` / `touchend`                        | finger up |

The page converts its own canvas coordinates to logical Touch Bar pixel
coordinates (accounting for the CSS scale factor), sends them as small JSON
WebSocket messages (`{ type: "touchstart" | "touchmove" | "touchend", x, y }`),
and the preview server forwards them directly into the same
`touchStart`/`touchMove`/`touchEnd` API real Touch Bar hardware already
drives — there is no separate input system for the preview.

### Standalone panel window (no browser tab)

`preview-app/` docks the preview to the bottom of the screen as a real panel
— reserved space, like waybar — instead of requiring a manual browser tab.
It's a small Python/GTK app (`gtk_layer_app.py`) using
[`gtk-layer-shell`](https://github.com/wmww/gtk-layer-shell) (the same
library waybar itself is built with) to anchor a window via the Wayland
layer-shell protocol, with an exclusive zone that actually reserves the
space so other windows don't overlap it.

**This requires a layer-shell compositor** — niri, Sway, Hyprland, River, or
similar wlroots-family Wayland compositors. It does not apply to GNOME, KDE,
or X11-only sessions; there's no equivalent protocol there for a
non-compositor app to reserve screen space.

It draws no HTML/DOM UI and doesn't embed a browser engine at all: it speaks
`src/dev/preview-server.ts`'s WebSocket protocol directly (a small hand-rolled RFC
6455 client — see the comment at the top of `gtk_layer_app.py` for why it
doesn't use libsoup's client) and paints the received RGBA bytes straight
onto a `GtkImage` via `GdkPixbuf`, which matches the wire format byte-for-byte
with no conversion needed.

Dependencies (all standard Arch desktop packages — nothing to install via
npm): `python-gobject`, `gtk3`, `gtk-layer-shell`.

```sh
sudo pacman -S --needed python-gobject gtk3 gtk-layer-shell
```

Start the preview server first, from `linux-touchbar-control-center`:

```sh
npm run dev:preview
```

Then in another terminal, from the repository root:

```sh
npm run preview:window
```

Press <kbd>Esc</kbd> while it's focused to close it (it has no titlebar).

### Notes

- A frame is only sent when the renderer actually produces one — the existing
  flush-rate cap (`RenderOptions.flushFps`, default 30) already throttles
  this upstream, so there's no added busy loop. A slow or backed-up browser
  tab has frames dropped for it rather than queued in memory.
- The server keeps the last frame in memory, so reloading the page or opening
  a second tab shows the current UI immediately instead of a blank canvas.
- The control center still opens a real keyboard device for global shortcuts
  (e.g. the screenshot combo) even in preview mode — this needs the same
  `video`/`input` group membership and fresh login session as
  [Manual start](#manual-start) already describes. Touch Bar
  hardware and a DRM device are not needed either way.

## Active window integration

Application-specific controls require an active-window backend.
omarchy-touchbar selects one automatically:

- GNOME Wayland uses
  [Window Monitor Pro](https://extensions.gnome.org/extension/8549/window-monitor-pro/),
  installed separately by the user — it is not bundled here
- KDE Plasma Wayland uses KWin scripting
- Hyprland uses its IPC socket
- Xorg uses `xprop`

A logout and login may be required when the extension is installed for the
first time. `xorg-xprop` must be installed for Xorg sessions. Unsupported Wayland
desktops can still run the Touch Bar UI, but application-specific controls
that depend on the focused window will not work.

## Media progress bar support (mpris)

The control center displays a visual playback progress bar for media players
that expose an MPRIS2 D-Bus interface. Spotify registers its own
`org.mpris.MediaPlayer2.spotify` service and works without additional setup.

Current Brave and Chromium builds expose their media sessions directly through
MPRIS2. This also works when the browser is installed as a Flatpak. Verify the
active service during playback with:

```sh
busctl --user list | grep org.mpris.MediaPlayer2
```

omarchy-touchbar recognizes `brave` and `chromium` services directly. Some other
Chromium-based browsers do not expose MPRIS2. For those browsers, Plasma Browser
Integration can provide an
`org.mpris.MediaPlayer2.plasma-browser-integration` service:

- [Chrome Web Store](https://chromewebstore.google.com/detail/plasma-integration/cimiefiiaegbelhefglklhhakcgmhkai)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/plasma-integration/)

The extension requires the native Plasma Browser Integration host supplied by
the distribution; the extension alone cannot publish a D-Bus service. The
progress bar works on any desktop once an MPRIS2 service is present. It updates
live, shows album art embedded in the track title row, and supports seek
(tap/drag on the progress track or use the skip-back/skip-forward buttons).

## Keyboard shortcuts

Physical keyboard shortcuts recognised by the control center. All shortcuts
are injected via uinput. They work regardless of which application has focus.

### Layer navigation

| Shortcut | Action |
|---|---|
| Long-press **Fn** | Toggle the F‑key layer (F1–F12 and Esc on wide Touch Bars). Hold again to return. |
| Long-press **Right Alt** (⌥) | Toggle the app dock. Long-press again to close it and return to the previous layer. |

### Screenshots

| Shortcut | Action |
|---|---|
| **Ctrl + Alt + S** | Save the current Touch Bar screen as a PNG into `~/Pictures/touchbar/`. |

### Browser shortcuts

Available when a supported browser window is focused and the Browser Panel is
shown on the left side of the split layer.

| Shortcut | Action |
|---|---|
| **Alt + ←** | Back |
| **Alt + →** | Forward |
| **Ctrl + R** | Reload |
| **Alt + Home** | Home |
| **Ctrl + T** | New tab |
| **Ctrl + W** | Close tab |
| **Ctrl + Tab** | Next tab |
| **Ctrl + Shift + Tab** | Previous tab |

Key overrides per browser can be configured in `linux-touchbar-control-center/config.ts`
(`BROWSER_KEY_OVERRIDES`).

## Konsole integration

The Konsole panel can show suggestions without additional configuration.
Sending commands requires Konsole's security-sensitive D-Bus API:

```sh
kwriteconfig6 --file konsolerc --group KonsoleWindow --key EnableSecuritySensitiveDBusAPI true
```

The key must be stored in the `[KonsoleWindow]` group of
`~/.config/konsolerc`. Konsole reads it only at startup, so close all Konsole
windows before starting it again. With `UseSingleInstance=true`, the process
continues running while any window remains open.

Command suggestions use read-only D-Bus methods and work without this setting.
Enabling the security-sensitive API allows any process on the session bus to
send text and commands to open Konsole sessions.

_Last updated: 2026-09-24_

## Credits and license

Omarchy Touch Bar is licensed under GPL-3.0-or-later. It builds on the work of
others, and that attribution is preserved:

- **Muhammad Adel** — the original `react-drm` renderer this project is built
  on: <https://github.com/dev-muhammad-adel/react-drm>
- **André Eikmeyer** (`dev@deqrocks`) — the system integration scripts
  (`install.sh`, `uninstall.sh`)
- The **t2linux** project and the wider T2 MacBook-on-Linux community, whose
  driver work and device testing this depends on

This repository is an independent, fork-free distribution of that work under
its original license. Contributions are welcome.


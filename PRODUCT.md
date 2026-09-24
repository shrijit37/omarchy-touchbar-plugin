# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

This is a **Linux-desktop** `adaptive` product, not an iOS or Android one. The
product adapts its design language per host, in two independent directions:

- **Per desktop environment** — the Touch Bar must behave correctly under GNOME,
  KDE Plasma, Niri, Hyprland, and Xorg, each with its own active-window backend
  and its own expectations for how a system surface is built.
- **Per surface type** — the same product ships a DRM/KMS-rendered hardware
  strip, two Electron shells (config editor, install wizard), and a GTK tool.
  These are not the same canvas and do not share interaction affordances.

The governing rule, borrowed from native-platform practice: **on each host
surface, that environment's conventions govern structure, and the product
expresses itself through the layer the environment leaves open.** A community
user on KDE should get a KDE-shaped experience, not the Omarchy one.

## Users

**Primary — T2 MacBook owners on Linux.** They own capable hardware they chose
to run Linux on, and the Touch Bar is a live, always-visible surface they
interact with daily. They arrive from one of two positions:

- currently running `tiny-dfr` or `mac-touchbar-plus`, which draw **static**
  function-key strips; or
- running a Linux where the Touch Bar has no working driver at all.

They are migrating, not shopping. Their job is to get a working, app-aware
control strip that survives suspend and resume **without breaking a system they
maintain themselves**. The bar is a daily-driver surface, so reliability and
non-destructiveness outrank feature breadth for them. The bar must simply be
there at login, respond to touch and function keys, and be back after resume.

They are also arriving on machines the maintainer has never touched: a desktop
environment they may not use, an Arch setup that is not the reference one. This
is the single most important fact about the primary user.

**Secondary — the maintainer.** Owns the product, runs it on their own T2
MacBook under Omarchy, and develops from a repository checkout rather than the
installed tree. Omarchy is the reference environment and the best-tested path,
not the definition of the product's audience.

## Product Purpose

Replace the Touch Bar's firmware function-key strip on T2 MacBooks running
Linux with an application-aware control center rendered directly to the DRM/KMS
display — and, underneath it, ship a reusable React renderer for drawing to
Linux DRM/KMS displays.

Success is that a stranger's T2 MacBook works after one run of the installer:

- attaches at login, with the firmware strip intact before login and after
  logout;
- responds to gestures, touch, and function keys;
- detaches cleanly before suspend; and
- returns intact after resume.

For the maintainer, the second half of the purpose is equally real: the renderer
must remain the durable asset that outlives any single control-center feature.

## Positioning

A **non-browser React renderer** that talks directly to DRM/KMS hardware:

- `src/` — the TypeScript/React renderer, built on `react-reconciler` and
  `yoga-layout`;
- a C++17 `node-addon-api` binding over **libdrm + Cairo**; and
- Yoga flexbox layout with spring-based animation.

Where `tiny-dfr` and `mac-touchbar-plus` draw static strips, this draws animated,
app-aware screens from React components at display frame rate. The control
center is the renderer's live proof and its most demanding client.

This claim cannot be truthfully copied by a neighboring product: it requires a
native DRM path, a C++ addon, and a real hardware panel.

## Operating Context

| Area | Requirement / behavior |
|---|---|
| Hardware | T2 Apple MacBooks running Linux |
| Required kernel modules | **t2linux** — `appletbdrm`, `hid-appletb-bl`, provided by the `linux-t2` kernel package. The installer seeds the `.env` and udev rules. |
| Desktop stacks | GNOME, KDE Plasma, Niri, Hyprland on Wayland; any Xorg desktop with `xprop` |
| Runtime | Node.js `>= 20.19` |
| Repository | npm workspaces monorepo: root `src/`, plus `linux-touchbar-control-center`, `config-gui`, `install-gui` |
| Language | TypeScript throughout; C++17 native addon |
| Native build | `node-gyp` via `binding.gyp` |
| Display | Touch Bar panel attached as a DRM/KMS display |
| Firmware behavior | Firmware function-key strip is replaced while the app runs; available before login and after logout |
| Runtime location | Everything runs from `~/.local/share/omarchy-touchbar` (deployed tree + full `node_modules` mirror + real `omarchy-touchbar` vendor package) — never from the repo/plugin checkout |
| Service | User systemd service `omarchy-touchbar.service`, `EnvironmentFile=` the installed `.env`, running unprivileged |
| Arch package policy | Only missing required packages are installed (`pacman -S --needed`): no repository refresh, no system upgrade. On a stale-db resolve failure the installer directs the user to `omarchy update`. |
| Installation | `./install.sh install` — analyze → purge → deploy. Arch-family only (Omarchy is the reference). `--yes` skips typed confirmations, `analyze` is a read-only pre-flight that changes nothing. |
| Uninstallation | `./uninstall.sh uninstall` — stops/removes the service (incl. legacy `react-drm.service`), udev rules, launcher and the installed copy; restores the firmware Touch Bar. Checkout, system packages and `video`/`input` group memberships are left unchanged. |
| Development entry | `./dev.sh` from the repository checkout — not from the installed tree |
| Preview backend | WebSocket pixel stream via `src/dev/preview-server.ts` + `src/dev/preview-page.html`; `OMARCHY_TOUCHBAR_BACKEND=preview` selects it. The canvas is the **real renderer output**, not a DOM re-implementation. |
| GTK preview | `preview-app/gtk_layer_app.py` — layer-shell panel, wlroots-family compositors only |

### Development Without Hardware

Observability is available without root access or physical Touch Bar hardware.
A DRM device, root, and Touch Bar hardware are needed only to compile the native
addon once, not to run preview mode. This is what makes contributions from
users without the hardware possible at all.

## Capabilities and Constraints

### React Renderer

`Box`, `Text`, `Button`, `Svg` (including GIFs and SVG container scenes),
`SwipeZone`, `ScrollRow`, Yoga flexbox layout, spring-based animation and
transitions, safe-area insets, touch-gesture handling, lock/tap suppression,
keyboard and function-key input, and compositor-unaware active-window tracking.

### Active-Window Backends

| Desktop / environment | Backend |
|---|---|
| GNOME | GNOME backend (via Window Monitor Pro) |
| KDE Plasma | KWin scripting |
| Hyprland | Hyprland IPC socket |
| Niri | Niri backend |
| Xorg | `xprop` |

Unsupported Wayland desktops can still run the control center; only
focused-window-dependent controls stop working.

### Control Center

Function keys; optional on-screen **Escape**; media, volume, and brightness
sliders; launcher; dock; weather, clock, and system widgets; audio visualization
via `cava`; a Pomodoro timer; small games; MPRIS2 media progress; Konsole
integration; and a custom-layer bridge to GUI tools.

### Supporting Tools

| Tool | Purpose |
|---|---|
| `linux-touchbar-control-center` | The product itself — the control center, run as a user service |
| `config-gui` | Electron editor that patches the bar's `config.ts` via `ts-morph` without clobbering formatting |
| `install-gui` | Electron wizard wrapping `install.sh` / `uninstall.sh` |
| GNOME Shell **Window Monitor Pro** | Focused-window information over D-Bus (installed separately by the user) |

### Touch Bar Geometry Constraints

These are runtime constraints, not cosmetic details. Panel width is dynamic
runtime information and must be detected, not hardcoded.

- Standard bar width: **2008 px** (also the renderer's fallback display size,
  `DEFAULT_DISPLAY_W`, used for hooks outside a renderer and for the preview
  canvas).
- Wide bar width: **2170 px**.
- Safe-area insets: `SAFE_INSET_X` = 11, `SAFE_INSET_Y` = 2.
- The on-screen **Escape** appears only on wide Touch Bars
  (`width >= 2170 px`) by default. The threshold is configurable through
  `ESC_KEY.minWidth` in `config.ts`.

### Explicitly Undecided

> [!NOTE]
> These points are intentionally unresolved and must not be treated as fixed
> product commitments.

#### Host Support Matrix

The installer supports **Arch-family distributions only**, with Omarchy as the
reference environment. All five desktop stacks stay covered by an
active-window backend — GNOME, KDE Plasma, Niri, Hyprland, and Xorg — but the
set of desktops the project is expected to support is **not fixed**.

With a community-primary audience this gap is load-bearing: the installer must
degrade honestly and predictably on hosts outside the matrix rather than guess.
Someone on a non-Arch distribution should be told plainly that they are
unsupported, not offered a partial install.

## Brand Commitments

| Item | Commitment |
|---|---|
| Product name | **Omarchy Touch Bar** |
| Wordmark | The Omarchy wordmark on the boot screen |
| License | GPL-3.0-or-later |
| Upstream author | Muhammad Adel — the `react-drm` renderer this product builds on |
| Upstream scripts | André Eikmeyer (`dev@deqrocks`) — the system integration in `install.sh` / `uninstall.sh` |
| Terminology | **Touch Bar**, **control center**, **Custom Layer**, `t2linux` |

The product is positioned as **the replacement for `tiny-dfr` and
`mac-touchbar-plus`**, not as a third option to choose between. This is a
naming and messaging commitment, not only a technical one — most prospective
users arrive by searching for a fix to the daemon they already run.

## Evidence on Hand

The evidence base is the repository itself:

- `README.md` — install, uninstall, service, preview, active-window, and
  shortcut documentation
- `package.json` — npm workspaces, Node engine, license, upstream author
- `LICENSE` — GPL-3.0
- `src/index.ts` — the renderer's public API surface
- `linux-touchbar-control-center/config.ts` / `config.blueprint.ts` — the
  control-center configuration contract
- `install.sh` / `uninstall.sh` — the install and restore contract
- `lib/themes.ts` — `macos`, `adwaitadark`, `darkhighcontrast`

> [!IMPORTANT]
> **No external testimonials, usage data, adoption numbers, or case studies
> exist in the repository.** The community is now the primary audience, but
> there is no evidence yet that anyone outside the maintainer has a working
> install. Future work must not invent them, and must not imply breadth of
> adoption that has not been demonstrated.

## Product Principles

1. **The DRM/KMS renderer is the product.** The control center is its proof and
   its first demanding client. Renderer work outlives any single feature.

2. **Reliability before feature breadth.** Touch Bar reliability outranks feature
   count: attach reliably, detach cleanly, survive suspend and resume, remain
   available as the expected input surface. A bar that is missing half the time
   is worse than a bar with fewer controls.

3. **Real inference, no assumptions.** Runtime state is detected, not hardcoded —
   active window, panel width, hardware presence, conflicting daemons. The
   community user is on a machine the maintainer has never seen; guessing is how
   their install breaks.

4. **Non-destructive system interaction is a hard invariant.** No partial
   upgrades, no system-level changes without confirmation, and the firmware
   Touch Bar must be restorable on uninstall. The user maintains their own
   machine and will notice.

5. **Omarchy is the reference environment, not the definition.** Omarchy-first
   integration stays first-class and best-tested. But "it works on Omarchy" is
   a floor, not a ceiling: every install path must be safe and honest on a
   distribution and desktop outside that reference, and unsupported hosts must
   fail visibly rather than half-work.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established in a confirmed
answer. That gap is real and is recorded here rather than filled with invention.

What exists today:

- standard display-brightness controls;
- a high-contrast theme, `darkhighcontrast` in `THEME.theme` (`lib/themes.ts`),
  alongside `macos` and `adwaitadark`.

The Touch Bar's physical size, curved panel, and touch-only input are a
first-order constraint on any future accessibility work, and no such work has
been specified yet.

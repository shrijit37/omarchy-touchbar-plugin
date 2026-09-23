# Omarchy Touch Bar — Product

> Product definition for the Omarchy-first Touch Bar control center and React DRM/KMS renderer.

## Platform

**Web**

## Users

**Primary user:** The maintainer, running this on their own Apple T2 MacBook under Omarchy.

**Secondary audience:** The t2linux community. The project intends to replace `tiny-dfr` / `mac-touchbar-plus` on T2 MacBooks running Linux, but confirmed work is Omarchy-first.

## Product Purpose

Replace the Touch Bar's firmware function-key strip on T2 MacBooks running Linux with an application-aware control center rendered directly to the DRM/KMS display, plus a reusable React renderer for drawing to Linux DRM/KMS displays.

Success means the control center is the reliable, always-available input surface the firmware strip used to be:

- attach at login;
- interact via gestures and function keys;
- detach cleanly before suspend; and
- return intact after resume.

## Positioning

A **non-browser React renderer** that talks directly to DRM/KMS hardware through:

- `src/` for the TypeScript/React renderer;
- a C++17 `node-addon-api` binding over **libdrm + Cairo**; and
- Yoga for flexbox layout.

The control center is the live proof and primary consumer of that renderer. On the same hardware where `tiny-dfr` and `mac-touchbar-plus` draw static strips, this project draws animated, app-aware screens from React components with Yoga flexbox layout, gestures, springs, and GIFs at display frame rate.

## Operating Context

| Area | Requirement / behavior |
|---|---|
| Hardware | T2 Apple MacBooks running Linux |
| Required kernel modules | Per driver stack: **t2linux** → `appletbdrm`, `hid-appletb-bl`; **kait2en** → `t2bdrm`. The installer auto-detects the stack (`--profile` forces it) and seeds the matching `.env`/udev profile. |
| Desktop stacks | GNOME, KDE Plasma, Niri, Hyprland on Wayland; any Xorg desktop with `xprop` |
| Runtime | Node.js `>= 20.19` |
| Repository | npm workspaces monorepo |
| Language | TypeScript throughout; C++17 native addon |
| Native build | `node-gyp` via `binding.gyp` |
| Display | Touch Bar panel attached as a DRM/KMS display |
| Firmware behavior | Firmware function-key strip is replaced while the app runs |
| Runtime location | Everything runs from `~/.local/share/omarchy-touchbar` (deployed tree + full `node_modules` mirror + real `omarchy-touchbar` vendor package) — never from the repo/plugin checkout |
| Service | User systemd service: `omarchy-touchbar.service`, `EnvironmentFile=` the installed `.env` |
| Service command | `node ~/.local/share/omarchy-touchbar/linux-touchbar-control-center/dist/index.js` |
| Arch package policy | Only missing required packages are installed (`pacman -S --needed`): no repository refresh, no system upgrade. On a stale-db resolve failure the installer directs the user to `omarchy update` (Omarchy's ALPM hook blocks direct `pacman -Syu`). |
| Installation | `./install.sh install` — analyze → purge → deploy; `--yes` skips typed confirmations, `--profile t2linux|kait2en` pins the driver stack, `analyze` subcommand is a read-only pre-flight |
| Uninstallation | `./uninstall.sh uninstall` (Omarchy: `uninstall-omarchy.sh`) — stops/removes the service (incl. legacy `react-drm.service`), udev rules, launcher and the installed copy; restores the firmware Touch Bar. Checkout, system packages and group memberships untouched. |
| Preview backend | WebSocket pixel stream via `dev/preview-server.ts` + `preview-page.html` |
| GTK preview | `preview-app/gtk_layer_app.py` |
| Backend switch | `REACT_DRM_BACKEND=preview` |

### Development Without Hardware

Observability is available without root access or physical Touch Bar hardware:

1. **Browser preview:** pixels stream over WebSocket through `dev/preview-server.ts` and `preview-page.html`.
2. **GTK preview:** `preview-app/gtk_layer_app.py` renders through a GTK layer-shell window.
3. Set `REACT_DRM_BACKEND=preview` to switch the application to the preview backend.

## Capabilities and Constraints

### React Renderer

The renderer provides:

- `Box`
- `Text`
- `Button`
- `Svg`, including GIFs and SVG container scenes
- `SwipeZone`
- `ScrollRow`
- Yoga flexbox layout
- spring-based animation and animated transitions
- safe-area insets for the Touch Bar's curved panel
- touch-gesture handling
- lock/tap suppression
- keyboard and function-key input
- compositor-unaware active-window tracking

### Active-Window Backends

Supported active-window detection backends:

| Desktop / environment | Backend |
|---|---|
| GNOME | GNOME backend |
| KDE Plasma | KDE backend |
| Hyprland | Hyprland backend |
| Niri | Niri backend |
| Xorg | `xprop` |

### Control Center

The control center includes:

- function keys;
- optional on-screen **Escape**;
- media, volume, and brightness sliders;
- launcher;
- dock;
- weather, clock, and system widgets;
- audio visualization via `cava`;
- focus timer;
- small games; and
- a custom-layer bridge to GUI tools.

### Supporting Tools

| Tool | Purpose |
|---|---|
| `config-gui` | Electron editor that patches the bar's `config.ts` using `ts-morph` without clobbering formatting |
| `install-gui` | Electron wizard wrapping `install.sh` / `uninstall.sh` |
| `config-gui-python` | GTK/PyGObject configuration editor |
| GNOME Shell **Window Monitor Pro** | Focused-window information over D-Bus |

### Touch Bar Geometry Constraints

The Touch Bar dimensions and safe area are runtime constraints, not cosmetic details.

- Standard bar width: **2008 px**
- Wide bar width: **2170 px**
- Safe-area insets: `SAFE_INSET*`
- Panel width must be treated as dynamic/runtime information.
- On-screen **Escape** appears only on wide Touch Bars (`width >= 2170 px`) by default.
- The Escape threshold is configurable through `ESC_KEY.minWidth` in `config.ts`.

## Explicitly Undecided

> [!NOTE]
> These points are intentionally unresolved and should not be treated as fixed product commitments.

### Host Support Matrix

Current installers cover:

- Fedora
- Debian
- Ubuntu
- Arch
- GNOME
- KDE
- Niri
- Hyprland
- Xorg

The full set of desktop environments this project is expected to support is not yet fixed.

## Brand Commitments

| Item | Commitment |
|---|---|
| Product name | **Omarchy Touch Bar** |
| Wordmark | The Omarchy wordmark on the boot screen |
| License | GPL-3.0-or-later |
| Original author | Muhammad Adel (upstream `react-drm`) |
| Terminology | **Touch Bar**, **control center**, **Custom Layer**, **t2linux**, **kait2en** |

## Evidence on Hand

The current evidence base is the repository itself:

- `README.md`
- `package.json` (npm workspaces)
- `LICENSE` (GPL-3.0)
- renderer public API surface: `src/index.ts`
- control-center configuration: `config.ts` / `config.blueprint.ts`
- installer scripts

> [!IMPORTANT]
> No external testimonials or documented usage exist in the repository at present.

## Product Principles

Based on confirmed facts from the user interview and repository; this list is not exhaustive.

### 1. DRM/KMS Renderer Is the Product

The DRM/KMS renderer is the core product. The control center is its proof and its first demanding client.

### 2. Reliability Before Feature Breadth

Touch Bar reliability outranks feature breadth.

The bar must:

- attach reliably;
- detach cleanly;
- survive suspend/resume; and
- remain available as the expected input surface.

### 3. Real Inference, No Assumptions

Runtime state should be detected rather than hardcoded, including:

- active window;
- panel width;
- hardware presence; and
- conflict detection.

### 4. Non-Destructive System Interaction

Installation and upgrades must be non-destructive.

This is a hard invariant:

- no partial upgrades;
- no system-level changes without confirmation; and
- the firmware Touch Bar must be restorable on uninstall.

### 5. Omarchy-First Integration

Omarchy-first integration remains first-class for the maintainer even as the project aims to become generic.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established in a confirmed answer.

The control center does expose:

- standard display-brightness controls; and
- a high-contrast theme: `darkhighcontrast` in `THEME.theme`.

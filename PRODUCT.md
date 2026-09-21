# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: the maintainer, running this on their own Apple T2 MacBook under
Omarchy. The t2linux community is a secondary audience — the project intends to
replace `tiny-dfr` / `mac-touchbar-plus` on T2 MacBooks running Linux — but
confirmed work is Omarchy-first.

## Product Purpose

Replace the Touch Bar's firmware function-key strip on T2 MacBooks running
Linux with an application-aware control center rendered directly to the DRM/KMS
display, plus a reusable React renderer for drawing to Linux DRM/KMS displays.
Success means the control center is the reliable, always-available input surface
the firmware strip used to be — attach at login, interact via gestures and
function keys, detach cleanly before suspend, and return intact after.

## Positioning

A non-browser React renderer that talks to the DRM/KMS hardware directly
(`src/` + a C++17 `node-addon-api` binding over libdrm + Cairo), instead of
being a web page wrapped in a window. The control center is the live proof and
primary consumer of that renderer: on the same hardware where `tiny-dfr` and
`mac-touchbar-plus` draw static strips, it draws animated, app-aware screens
from React components with Yoga flexbox layout, gestures, springs, and GIFs at
display frame rate.

## Operating Context

- T2 Apple silicon MacBooks running Linux (t2linux), kernel modules
  `appletbdrm` and `hid-appletb-bl` required.
- Linux desktop stacks: GNOME, KDE Plasma, Niri, Hyprland on Wayland; any Xorg
  desktop with `xprop`.
- Node.js ≥ 20.19, npm workspaces monorepo, TypeScript everywhere; C++17 native
  addon built with `node-gyp` via `binding.gyp`.
- Touch Bar panel attached as a DRM/KMS display; the firmware function-key strip
  is replaced while the app runs.
- Runs as a user systemd service (`omarchy-touchbar.service`) via `node dist/index.js`.
- Installation/distribution distributed through `./install.sh` (analyze →
  purge → deploy) and `./uninstall.sh` (restores the firmware Touch Bar).
- Dev-time observability without root or hardware: pixels stream over WebSocket
  to a browser (`dev/preview-server.ts` + `preview-page.html`) or a GTK
  layer-shell window (`preview-app/gtk_layer_app.py`). `REACT_DRM_BACKEND=preview`
  switches the app to this backend.

## Capabilities and Constraints

- React renderer: `Box`, `Text`, `Button`, `Svg` (including GIFs and SVG
  container scenes), `SwipeZone`, `ScrollRow`; Yoga flexbox layout; springs and
  animated transitions; safe-area insets for the panel's curve; gesture system
  (touch gestures, lock/tap suppression) and keyboard/function-key input;
  compositor-unaware active-window tracking (backends: GNOME, KDE, Hyprland,
  Niri, Xorg).
- Control center app: function keys + optional on-screen Escape (wide 2170px
  bars only, configurable), media/volume/brightness sliders, launcher, dock,
  weather/clock/system widgets, audio visualization (cava), focus timer, small
  games, custom-layer bridge to GUI tools.
- Supporting tools: `config-gui` (Electron editor that patches the bar's
  `config.ts` via `ts-morph` without clobbering formatting), `install-gui`
  (Electron wizard over install.sh/uninstall.sh), `config-gui-python`
  (GTK/PyGObject), and the GNOME Shell "Window Monitor Pro" extension (focused
  window info over D-Bus).
- On-screen Escape key shows only on wide Touch Bars (width ≥ 2170 px) by
  default; controlled by `ESC_KEY.minWidth` in `config.ts`.
- Touch Bar safe-area insets (`SAFE_INSET*`) and panel-width awareness are real
  constraints; the standard bar is 2008 px, wide is 2170 px.

### Explicitly undecided

- Host support matrix: current installers cover Fedora/Debian/Ubuntu/Arch and
  GNOME/KDE/Niri/Hyprland/Xorg; the full set of desktop environments this is
  expected to run on is not fixed.
- Whether Arch upgrades (the `-Syu` → `-S` change in the local working tree)
  are a permanent Omarchy-first policy or a branch-local deviation.

## Brand Commitments

- Name: **Omarchy Touch Bar**. Wordmark: the omarchy wordmark on the boot screen.
- License GPL-3.0-or-later, original author Muhammad Adel (upstream react-drm).
- "Touch Bar", "control center", "Custom Layer" and "t2linux"/"kait2en" are
  consistent terminology.

## Evidence on Hand

From the repository itself: `README.md`, `package.json` (workspaces),
`LICENSE` (GPL-3.0), the renderer public API surface (`src/index.ts`), the
control-center config (`config.ts` / `config.blueprint.ts`), and the installer
scripts. No external testimonials or documented usage exist in-repo.

## Product Principles

Based on confirmed facts from user interview + repo; not exhaustive.

1. The DRM/KMS renderer is the product; the control center is its proof and its
   demanding first client.
2. Reliability of the Touch Bar surface outranks feature breadth — if the bar
   doesn't attach, detach, and survive suspend/resume, nothing else matters.
3. Real inference, no assumptions: active-window detection, panel width,
   hardware presence, and conflict detection are all detected live, not hardcoded.
4. Non-destructive system interaction during install/upgrade is a hard
   invariant — no partial upgrades, no system-level changes without
   confirmation, firmware Touch Bar must be restorable on uninstall.
5. Omarchy-first integration stays first-class for the maintainer even as the
   tool aims to be generic.

## Accessibility & Inclusion

No product-specific accessibility requirement was established in a confirmed
answer. The control center does expose standard display-brightness controls and
a high-contrast theme (`darkhighcontrast` in `THEME.theme`).
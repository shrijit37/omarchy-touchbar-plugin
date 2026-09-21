---
name: omarchy-touchbar
description: Touch Bar control center and DRM/KMS React renderer for T2 MacBooks on Linux
colors:
  background: "#000000"
  surface: "#373737"
  surface-variant: "#474747"
  primary: "#5b8def"
  primary-hover: "#4a74d6"
  secondary: "#373737"
  text-primary: "#cccccc"
  text-secondary: "#94a3b8"
  text-disabled: "#64748b"
  border: "#171717"
  divider: "#1e293b"
  success: "#4ade80"
  warning: "#fde047"
  error: "#f87171"
  info: "#38bdf8"
  overlay: "#272727"
  shadow: "#000000"
  gui-bg: "#0d0f14"
  gui-panel: "#171a21"
  gui-panel-hi: "#21262f"
  gui-border: "#2a2f3b"
  gui-text: "#eef0f3"
  gui-text-muted: "#939bad"
  gui-cyan: "#7dd3fc"
  gui-violet: "#a78bfa"
  gui-danger: "#fb7185"
  gui-ok: "#4ade80"
typography:
  display:
    fontFamily: "IosevkaTerm Nerd Font"
  body:
    fontFamily: "IosevkaTerm Nerd Font"
  label:
    fontFamily: "IosevkaTerm Nerd Font"
rounded:
  sm: "6px"
  key: "10px"
  slot: "14px"
spacing:
  gap: "6px"
  inset-x: "11px"
  inset-y: "2px"
components:
  btn-key:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.key}"
    borderColor: "{colors.border}"
  btn-key-active:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.key}"
    borderColor: "{colors.border}"
  dock-icon:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.slot}"
  gui-button-primary:
    backgroundColor: "{colors.gui-cyan}"
    textColor: "{colors.gui-bg}"
    rounded: "{rounded.sm}"
  gui-button-disabled:
    backgroundColor: "{colors.gui-cyan}"
    textColor: "{colors.gui-bg}"
    rounded: "{rounded.sm}"
---

# Design System: Omarchy Touch Bar

## Overview

**Creative North Star: "The Slim Black Module"**

Omarchy Touch Bar is a dense, dark, glass-and-token system that lives on two canvases: the physical **Touch Bar** (a 2008–2170 px by ~60 px DRM panel) and the desktop **GUI shells** (config-gui, install-gui) that configure it. On the bar, the identity is **black glass over the machine**: `#000000` backgrounds, subtly graded `#373737`/`#474747` module surfaces, a single crisp `2px` hairline border, and one restrained blue `#5b8def` accent for interactivity. Every pixel is accounted for — the bar has almost no room, so the system buys legibility through contrast between a true-black field and stepped mid-dark surfaces, and buys motion through springs that overshoot ("ring") like macOS.

The GUI shells are the bar's control room and share its DNA without pretending to be the hardware: a near-black indigo (`#0d0f14`) canvas with translucent **glass panels** (`rgba(23,26,33,0.55)` + `blur(18px)`) over faint cyan/violet ambient gradients, and a single bright cyan-to-violet **accent gradient** (`#7dd3fc` → `#a78bfa`) reserved for primary action blocks and the active state. Both canvases speak the same grammar — dark module on darker field, hairline dividers, one bright accent, radius in the 6–14px band — so the suite reads as one product family.

The system is fundamentally **tonal, not shadowed**: depth on the bar comes from layered mid-greys over black (no drop shadows in production), and in the GUI from translucent tint + backdrop blur, never hard shadows. Text is a three-tier slate scale (`#cccccc` → `#94a3b8` → `#64748b` on the bar; `#eef0f3` → `#939bad` → `#5c6377` in the GUI). Status is a single consistent traffic-light of semantic accents — success/warning/error/info — used identically across both worlds so battery, temperature, network, and system health read at a glance.

**Key Characteristics:**
- True-black hardware canvas with stepped mid-dark module surfaces — contrast through layering, not light.
- One restrained primary accent per surface (`#5b8def` on the bar, cyan/violet gradient in the GUI).
- Hairline `2px` borders and dividers; radius band 6–14px, more for motion halos.
- Depth is tonal/glass, never drop-shadow-driven.
- Springs overshoot and ring (launch bounce, press glow); continuous values breathe in sync.
- Text is a three-tier slate scale; status is one persistent traffic-light system.
- Fixed safe-area insets (`11px` horizontal, `2px` vertical) defend against pixel-shift clipping on the hardware panel.

## Colors

The default `macos` palette (in `linux-touchbar-control-center/lib/themes.ts`) is documented here as normative; it matches the app's original built-in colors. Two alternates ship: `adwaitadark` (GNOME-indigo) and `darkhighcontrast` (pure black + luminous accents).

### Primary
- **Soft Accord Blue** (`#5b8def`, hover `#4a74d6`): the single interactive accent on the bar. Used for function key highlights, the dock's running indicator, focus, and the active state of interactive modules. Recedes at rest; asserts itself only when there is something to press or something is live.

### Secondary
- **Iron** (`#373737`): the resting fill of interactive surfaces (function keys, dock slots) — the same value as the Surface neutral, so secondary affordances read as "neutrals you can press."

### Neutral
- **Void** (`#000000`): the bar's frame background, the boot screen, and the field behind all content. Its purity against the stepped surfaces is the system's core contrast engine.
- **Iron** (`#373737`): standard surface modules; the resting state of keys.
- **Rampart** (`#474747`): the pressed/hovered elevation of surfaces (the `surfaceVariant` slot).
- **Ash Slate** (`#cccccc`): primary text.
- **Muted Slate** (`#94a3b8`): secondary text, sub-labels.
- **Faded Slate** (`#64748b`): disabled text.
- **Carbon Edge** (`#171717`): the `2px` hairline border around keys and modules.
- **Slate Line** (`#1e293b`): dividers between modules.
- **Umbra** (`#272727`): overlay scrim; `#000000` shadow color (shadow color is black; in practice the bar is tonal).

### GUI (config-gui / install-gui)
- **Deep Indigo** (`#0d0f14`): GUI canvas; ambient cyan/violet radial glows (at `14%`/-8% and `100%`/0%, ~`#7dd3fc14` / `#a78bfa12`) breathe behind it.
- **Iron Panel** (`#171a21`), **Rampart Panel** (`#1c202a`), **Panel-hi** (`#21262f`): stepped panel surfaces.
- **Hairline Edge** (`#2a2f3b`), **Soft Edge** (`#20242e`): GUI borders.
- **Paper White** (`#eef0f3`), **Muted Blue-Grey** (`#939bad`), **Faint Blue-Grey** (`#5c6377`): GUI text tiers.
- **Aqua Cyan** (`#7dd3fc`) and **Amethyst Violet** (`#a78bfa`): the accent gradient, its two constituents.
- **Danger Rose** (`#fb7185`), **Ok Green** (`#4ade80`).

### Named Rules
**The One-Accent Rule.** Each surface carries exactly one voice of bright accent — the bar uses Soft Accord Blue alone, the GUI uses the cyan→violet gradient alone. Secondary and status colors never compete with it.

## Typography

**Display/System Font:** Iosevka Term Nerd Font (the bar's `THEME.fontFamily`, overridable in `config.ts`; UI shells use `-apple-system, "Segoe UI", "Cantarell", "Noto Sans", Roboto` + `"JetBrains Mono"` / `ui-monospace` for code).
**Body Font:** same as Display on the bar (one family, all weights).
**Label/Mono Font:** JetBrains Mono / `ui-monospace` family in the GUI for config values and install log output.

**Character:** The bar speaks one font family in a tight size band with heavy geometric weights (`700` F-key labels at `24px`, `650` in the GUI buttons); glyph-based icons (react-icons, Material Design & Font Awesome) replace decorative type. The UI shells pair a clean sans UI face with a mono face for code, keeping the tool dense and technical, not decorative.

### Hierarchy
- **Display** (`700`, `24px` on the bar; GUI app title `13.5px`/`700`): F-key and Esc labels; the bar's loudest text.
- **Headline** (`600–700`, ~`12–13px` ticket): dock/launcher item labels, module headings.
- **Title** (`600`, ~`12px`): back-button and layer titles.
- **Body** (`400`, `12px`–`13.5px` on the bar; `13.5px` GUI): module secondary text, slider readouts, launcher entries.
- **Label** (`500–600`, ~`10–11px`, occasional `uppercase`): compact widget labels (battery %, weather, caps-lock).

### Named Rules
**The One-Family Rule.** On the bar, one typeface (Iosevka Term Nerd Font) carries every weight and role. Hierarchy is made by weight, size, and color — never by adding a second family.

## Layout

The Touch Bar is a fixed horizontal canvas (~60px tall) on Yoga flexbox via the renderer. Content flows in a single row of modules with `6px` gutters (`gap: 6`) and `8px` horizontal padding. Interactive keys are **flex-equal** (`flex: 1`, `alignItems/justifyContent: center`) so F-keys and Esc share the width evenly.

A dedicated `SafeArea` wrapper reserves **`11px` horizontal / `2px` vertical** (`SAFE_INSET_X`/`Y`) against pixel-shift clipping. On **wide bars** (`≥2170px`) with no physical Esc, a fixed-width Esc key (`110px` + `8px` gap) occupies the far left; the layer area insets by exactly that width. The Touch ID gate deducts its block width from the live layer area mid-animation, so re-layout is continuous rather than snapping.

**Priority design of the layers / route tree** (`app/fnkeys`, `dock`, `media`, `launcher`, `lock`, `splitted`, `systembar`, `custom-layer`, plus overlays): layers are full-bleed `(w × h)`, content is a horizontal flex row, and layers slide/fade with a `200ms` out / `350ms` in transition. The GUIs use a `240px` sidebar + `1fr` main grid, glass panels, and the same `10px` / `6px` radius tiers.

## Elevation & Depth

Depth is **tonal on the bar, glass in the GUI** — this system does not rely on drop shadows.

On the hardware panel, elevation is a ladder of surfaces against the `#000000` void: `surface` (`#373737`) → `surfaceVariant` (`#474747`) → pressed `#2a2f3b`. A pressed key, module, or dock slot visibly climbs one rung by its fill value alone. The one shadow token, `shadow: #000000`, exists in the schema but is not a shadow-graphy driver.

In the GUI shells, depth is **translucent tint + backdrop blur**: `--glass: rgba(23,26,33,0.55)` with `--blur: blur(18px)` lets the ambient cyan/violet gradient read through panels. State feedback is a `filter: brightness()`/`filter` shift on a shared easing (`cubic-bezier(0.2, 0.7, 0.3, 1)`, `150ms`), not a lifted shadow.

**The Glass-Over-Tint Rule.** Where a surface needs to recede or host layered content, use translucent tint + blur over the ambient gradient (GUI), or a solid one-rung-lighter module fill (bar) — never a drop shadow to fake height.

## Shapes

Corner language is gentle and tight across both worlds, anchored in a `6px`–`14px` radius band:

- **Keys (F-row, Esc):** `10px` full-corner radius, `2px` `borderColor`/`borderWidth` hairline.
- **Dock slots:** `14px` radius; pressed/running glow halos are `borderRadius = height / 2` (pill) and scale with the slot.
- **Modules / panels:** `10px` radius in the GUI; GUI small controls `6px`.
- **Slider:** rounded, with a `SliderTrack` component; brightness/volume sliders read on the `surface` module.

Borders are `2px`-solid hairlines (bar keys) or `1px` hairlines (GUI panels `#2a2f3b` / `#20242e`). The only "clipping" silhouette is the hardware panel's own physical curve, which the safe-area insets respect.

**The 2px Hairline Rule.** Any border on the bar is exactly `2px`, colored `border`/`divider`. no heavier borders, no sharp 0px hairlines — the crisp edge is what separates interactive modules from the `#000000` field.

## Components

### Buttons (bar — key/held-key, `Button` + `motion.Button`)
- **Shape:** full-corner `10px` radius; `2px` `borderColor`/`borderWidth` hairline.
- **Primary / active:** background `surface` (`#373737`) → `surfaceVariant` (`#474747`) on press; text `textPrimary` (`#cccccc`), weight `700`, `24px`.
- **Hover / Focus / Active:** `activeColor` swap to `#474747`; press visual is a swap, with an `80ms` entry guard and ~`100ms` flash on release so a scroll passing over never lights it.
- **Long-press:** `500ms` default hold to fire a secondary action.
- **Secondary / Ghost:** the same neutral-key anatomy carries all key roles — F-keys, Esc, launcher entries.

### Chips / Pills (dock + custom-layer)
- **Style:** a small rounded pill; running indicator fills `#5b8def`-family `rgba(125,211,252,0.9)` when focused/pressed, and each app's color for running apps.
- **State:** focus → widens from a dot to a bright pill (transitions), press → glow ring springs open behind the icon (`BOUNCE` spring, tension 600/friction 8).

### Cards / Containers
- **Corner Style:** `14px` (dock slots) / `10px` (layers & GUI panels).
- **Background:** `surface` (`#373737`) on the bar; `--glass` tint + `backdrop-filter` in the GUI.
- **Shadow Strategy:** tonal layering + glass tint (see Elevation). No hard shadow.
- **Border:** `2px` `border` hairline (bar); `1px` `--border` (GUI).
- **Internal Padding:** GUI `20px 18px`; bar modules hug a `6px`-gap row.

### Inputs / Fields (GUI: search, config values)
- **Style:** near-black `#0d0f14` background, `1px` `--border` (`#2a2f3b`), `6px` radius, `12.5px` type.
- **Focus:** `border-color` → accent (`--cyan`), `:focus-visible` 2px accent outline with `2px` offset.
- **Placeholder:** `--text-faint` (`#5c6377`); primary text `#eef0f3`.

### Navigation
- **GUI sidebar:** `240px` glass column, header (gradient app icon on `#0d0f14` + `700` title), search field, scrollable nav group; active item highlighted with the accent.
- **Bar navigation:** BackButton, `BackButton` component; layer slide/fade `200ms` out / `350ms` in; overlays (`dock`, `fnkeys`, `custom-layer`) toggle via hardware shortcuts (single/long/double) and return home.

### Signature Component — The Dock
Slots are `iconSize 48px` on a `14px`-radius slot in a `6px`-gap row. Running apps breathe a soft halo behind the icon (`PULSE` at `1100ms` reverse-repeat), a pressed slot springs a glow ring open behind it over `600`/`8` spring, the icon overshoots/lifts on launch ("macOS/Plank bounce"), and a focused-app dot widens into a bright cyan pill at the panel's padded bottom edge. Every effect is its own `motion.Box` `animate` keyed off `pressed`/`running`.

## Do's and Don'ts

### Do:
- **Do** keep the bar's field pure `#000000` and let modules step up one rung (`#373737` → `#474747`) for any elevation or press state.
- **Do** use **exactly one accent** per surface — Soft Accord Blue on the bar, cyan→violet gradient in the GUI — and reserve it for interactive/live states.
- **Do** respect the fixed safe areas (`11px` horizontal, `2px` vertical) and the wide-bar Esc math (`layout.tsx`): the content never draws under the panel curve.
- **Do** use spring overshoot for physical, weighted motion (launch bounce, press glow) and `1100ms`-family continuous values for background breathe.
- **Do** keep text on the three-tier slate scale (`textPrimary`/`textSecondary`/`textDisabled`), and status to the traffic-light set (`success`/`warning`/`error`/`info`), identically across bar and GUI.
- **Do** use the 2px hairline (`border`) to separate interactive modules from the `#000000` field, and the Glass-Over-Tint approach (translucent `--glass` + `blur(18px)`) over an ambient gradient for GUI depth.

### Don't:
- **Don't** add drop shadows on the bar, or hard shadows in the GUI — depth is tonal/glass, not shadow-graphy.
- **Don't** introduce a second typeface to the bar; Iosevka Term Nerd Font covers every role.
- **Don't** invent a new accent or a new semantic status color beyond the traffic-light set — one accent and one status language, everywhere.
- **Don't** wrap button press feedback in a slow fade; press feedback is a `surfaceVariant` color swap with a ~`100ms` flash, and scroll-passing must never light a key.
- **Don't** use radius outside the 6–14px band for bounding surfaces, or apply the GUI gradient as a text/border treatment on the bar's `#000000` keys.
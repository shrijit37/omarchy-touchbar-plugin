# Development: Develop a Custom Plugin

**Updated:** 13 Aug 2026  
**Read time:** 12 min  
**Status:** Stable

Build in your user-owned plugin directory, edit a working Omarchy example, and validate the finished folder with the same manifest rules enforced by the Quattro shell.

> **Security and runtime note**
>
> Plugins share the long-running Omarchy shell process.
> They run unsandboxed with your user permissions. Review every dependency and command, avoid unnecessary privileges, and never start a second Quickshell process for a plugin.

---

## 01 — Clone a Built-in Plugin

This tutorial builds a **bar-widget with a details panel**, so the built-in clock is the closest working starting point.

### 1. Match the runtime contract

Choose a built-in with the same plugin kind and interaction pattern as the plugin you want to build.

### 2. Work in a user-owned copy

Edit the clone under your config directory, never the packaged Omarchy source.

### 3. Expect an immediate switch

The clone command discovers and enables the copy, then replaces the built-in clock in your active bar.

#### Terminal — create local copy

```bash
omarchy plugin clone omarchy.clock --edit
```

On success, the command prints the new plugin ID, creates its folder, and opens that folder in your configured editor:

#### Files — local plugin

```text
~/.config/omarchy/plugins/yourname.clock/
├── manifest.json
├── BarWidget.qml
├── Panel.qml
└── Model.js
```

Keep the clone ID while developing.

Use the **exact ID printed by the command**, such as `yourname.clock`, in every development example below. Saved changes reload automatically. Force discovery only when needed:

```bash
omarchy-shell shell rescanPlugins
```

Choose the permanent namespaced ID before publishing.

> Browse the built-in plugin examples before designing a new component from scratch.

---

## 02 — Define the Plugin Contract

The clone keeps the clock’s bar-widget contract. Use this reference when another plugin needs a different shell entry point.

### Plugin kind reference

| Plugin kind | `entryPoints` key | File loaded | Use it for |
|---|---|---|---|
| `bar-widget` | `barWidget` | `BarWidget.qml` | Item in the active bar |
| `panel` | `panel` | `Panel.qml` | Floating surface |
| `overlay` | `overlay` | `Overlay.qml` | Fullscreen surface |
| `menu` | `menu` | `Menu.qml` | Summoned menu |
| `service` | `service` | `Service.qml` | Headless singleton |
| `bar` | `bar` | `Bar.qml` | Full bar replacement |

For this tutorial, keep `bar-widget`, open `manifest.json`, and replace its contents with this complete development manifest.

> **Manifest**
>
> The details panel is part of this bar widget.
> Keep `kinds: ["bar-widget"]` and `entryPoints.barWidget: "BarWidget.qml"`.
> The entry point loads `Panel.qml` internally, so this example does not declare a separate panel kind.
> Keep the clone-generated `omarchy.clonedFrom` value while developing so disabling or removing the clone restores the built-in clock.

---

## 03 — Implement the Bar and Panel

`BarWidget.qml` is the manifest entry point. It displays the clock, loads `Panel.qml`, and forwards the panel lifecycle that Quattro uses for clicks and shell commands.

### `BarWidget.qml`

```qml
// Replace this block with the complete BarWidget.qml from the tutorial.
```

Now replace `Panel.qml`. Quattro’s `Panel` base provides the open state and controller; `KeyboardPanel` anchors the surface to the bar button, and Escape closes it through `PanelKeyCatcher`.

### `Panel.qml`

```qml
// Replace this block with the complete Panel.qml from the tutorial.
```

Both files belong to one bar-widget plugin.

The manifest loads `BarWidget.qml`; its `Loader` loads `Panel.qml`. Keep the same `moduleName` in both files, and do not add a second manifest kind for this nested panel.

This structure follows Omarchy’s built-in clock plugin and the Marketplace’s Agent Usage plugin. The official Omarchy shell reference remains the source of truth for the runtime contract.

---

## 04 — Validate the Folder

Check both parts of the plugin without running it. Omarchy validates the manifest and repository layout; `qmllint` checks the bar and panel against the installed shell imports.

### Terminal — validate

```bash
PLUGIN_ID="yourname.clock"
PLUGIN_DIR="$HOME/.config/omarchy/plugins/$PLUGIN_ID"
omarchy plugin validate "$PLUGIN_DIR"
qmllint -I "$OMARCHY_PATH/shell" \
  "$PLUGIN_DIR/BarWidget.qml" "$PLUGIN_DIR/Panel.qml"
```

Both commands should exit without an error. A broken manifest mapping gives an actionable message, for example:

### Example — validation failure

```text
entry point file not found: 'BarWidget.qml'
```

### Validation checks

- ✅ **Manifest parses as JSON**  
  `schemaVersion`, `id`, `name`, `version`, `kinds`, and `entryPoints` must be present and valid.

- ✅ **Kind and entry point agree**  
  A `bar-widget` needs `entryPoints.barWidget`; a standalone `panel` kind needs `entryPoints.panel`.

- ✅ **Every referenced file exists**  
  Manifest entry points must be safe relative paths, and every QML file passed to `qmllint` must exist.

- ✅ **No forbidden ID or symlink**  
  Third-party IDs cannot use `omarchy.*`, and plugin folders cannot contain symlinks.

---

## 05 — Run & Inspect the Plugin

The clone command already discovers, enables, and places the new bar widget. After validation succeeds, confirm that Quattro still lists it as enabled:

### Terminal — inspect status

```bash
PLUGIN_ID="yourname.clock"
omarchy plugin list --json \
  | jq --arg id "$PLUGIN_ID" '.[] | select(.id == $id)'
```

For the bar-widget example, the result should include your ID, kind, and enabled state:

### Example — discovered plugin

```json
{
  "id": "yourname.clock",
  "kinds": ["bar-widget"],
  "enabled": true
}
```

Test the panel through the same bar-widget ID. Quattro routes these commands to the `open()` and `close()` methods exposed by `BarWidget.qml`:

### Terminal — panel lifecycle

```bash
PLUGIN_ID="yourname.clock"
omarchy-shell shell summon "$PLUGIN_ID" '{}'
```

The command should open the clock details panel. Close it with **Escape**, then confirm the shell close route separately:

### Terminal — close panel

```bash
PLUGIN_ID="yourname.clock"
omarchy-shell shell hide "$PLUGIN_ID"
```

Before sharing, test:

- click
- Escape
- shell open and close
- disable
- re-enable
- shell restart
- removal

If a component does not load, continue to [Troubleshooting](#troubleshooting) below.

---

## 06 — Finished Example

After testing the plugin, replace the temporary clone ID with a permanent namespaced ID and remove the clone-only `omarchy.clonedFrom` field.

Move these files into a public repository, then select a file to inspect or copy it.

```text
custom-clock/
├── manifest.json
├── BarWidget.qml
├── Panel.qml
├── README.md
└── LICENSE
```

An optional `preview.png` can sit beside these files; it is binary, so it is not included in the copy-ready tree.

> **Use this as a structural reference.**
>
> Do not copy the ID, repository URL, author, or description unchanged. Document every external dependency, setup step, privilege boundary, service, installer, or remote build used by your plugin.

---

# Reference

## Troubleshooting

### ❗ Plugin Folder Not Found

Use the exact ID printed by `omarchy plugin clone` and confirm the folder under:

```text
~/.config/omarchy/plugins/
```

### ❗ Entry Point File Not Found

Make the value in `entryPoints` match the filename and capitalization on disk.

### ❗ The Plugin Validates but Is Not Listed

Run:

```bash
omarchy-shell shell rescanPlugins
```

Then inspect:

```bash
omarchy plugin list --json
```

### ❗ The Plugin Is Listed but Does Not Appear

Enable it, confirm the declared kind, and inspect QML errors:

```bash
qs log -p "$OMARCHY_PATH/shell" --tail 100
```

### ❗ A Panel Opens Once but Not Again

Forward `opened`, `open()`, and `close()` from the bar entry point to the loaded panel.

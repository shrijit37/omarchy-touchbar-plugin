import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

// The Omarchy Touch Bar's seat in the Omarchy bar.
//
// This plugin is a thin supervisor over the omarchy-touchbar Touch Bar daemon.
// The daemon is a Node + native DRM app built from this repo and deployed by
// install.sh to ~/.local/share/omarchy-touchbar, run as the user systemd
// service omarchy-touchbar.service. Everything this widget shows comes from
// probing that service; there is no QML renderer here.
//
// States: not installed (click → run installer in a terminal), installed but
// stopped (click → start the service), or running. When installed, the pill
// reflects systemctl --user is-active.
BarWidget {
  id: root
  moduleName: "io.github.shrijit37.omarchy-touchbar"

  property bool running: false
  property bool installed: false
  property bool statusParsed: false

  readonly property string serviceName: "omarchy-touchbar.service"
  readonly property string daemonBin: Quickshell.env("HOME") + "/.local/share/omarchy-touchbar/linux-touchbar-control-center/dist/index.js"
  readonly property string installPath: Qt.resolvedUrl("install-omarchy.sh").toString().replace(/^file:\/\//, "")
  readonly property bool showLabel: setting("showLabel", true) !== false

  readonly property string icon: installed
    ? (running ? "󰊪" : "󰊖")   // filled screen = running, dim = stopped
    : "󰊪"                       // setup state
  readonly property string label: !installed ? "Touch Bar · setup"
    : !running ? "Touch Bar · off"
    : "Touch Bar"

  readonly property string displayText: showLabel && !vertical ? icon + "  " + label : icon
  readonly property string tooltip: !installed
    ? "Install the Omarchy Touch Bar daemon"
    : !running ? "Touch Bar daemon is not running (click to start)"
    : "Touch Bar · running\nLeft: open config editor"

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  function refresh() {
    if (!installCheck.running && !statusProbe.running) installCheck.running = true
  }

  function install() {
    if (!installerProc.running) installerProc.running = true
  }

  Process {
    id: installCheck
    // -f, not -x: the deployed entry is a require()'d CommonJS file (0644 —
    // tsc output); systemd runs it via `node <path>`, so the executable bit
    // never exists on a healthy install. Existence IS the deployed marker.
    command: ["/usr/bin/test", "-f", root.daemonBin]
    running: true
    onExited: function(exitCode) {
      if (exitCode !== 0) {
        root.installed = false
        root.running = false
        return
      }
      root.installed = true
      root.statusParsed = false
      if (!statusProbe.running) statusProbe.running = true
    }
  }

  Process {
    id: statusProbe
    // The user service is the source of truth: the daemon starts at login and
    // the unit's ExecStopPost detaches the firmware strip back. "is-active"
    // returns 0 when it's up (active or activating), non-zero otherwise.
    command: ["/usr/bin/systemctl", "--user", "is-active", root.serviceName]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var raw = String(text || "").trim()
        if (raw === "active" || raw === "activating") {
          root.statusParsed = true
          root.running = true
        } else {
          root.statusParsed = true
          root.running = false
        }
      }
    }
    onExited: function(exitCode) {
      root.installed = true
      if (!root.statusParsed) root.running = false
    }
  }

  Timer {
    interval: 3000
    repeat: false
    running: statusProbe.running
    onTriggered: statusProbe.running = false
  }

  Process {
    id: starter
    command: ["/usr/bin/systemctl", "--user", "start", root.serviceName]
    onExited: function() { root.refresh() }
  }

  Process {
    id: installerProc
    command: [
      "/usr/bin/setsid", "/usr/bin/uwsm-app", "--", "/usr/bin/xdg-terminal-exec",
      "--app-id=org.omarchy.terminal", "--title=Omarchy Touch Bar Setup",
      "-e", "/usr/bin/bash", root.installPath
    ]
    onExited: function() { root.refresh() }
  }

  // The config editor (config-gui), launched exactly like the desktop entry's
  // Exec (electron shim + app dir) — a GUI app, so no terminal wrapper, just
  // uwsm-app for session integration. The repo checkout's node_modules is
  // wiped by finalize_plugin_folder after every install, so it is never the
  // launch source. Editing config.ts takes effect on the next service restart;
  // we deliberately do not restart here.
  Process {
    id: configProc
    readonly property string installRoot: Quickshell.env("HOME") + "/.local/share/omarchy-touchbar"
    command: [
      "/usr/bin/setsid", "/usr/bin/uwsm-app", "--",
      Quickshell.env("HOME") + "/.local/share/omarchy-touchbar/node_modules/.bin/electron",
      Quickshell.env("HOME") + "/.local/share/omarchy-touchbar/config-gui"
    ]
    onExited: function() { root.refresh() }
  }

  Timer {
    interval: 4000
    running: true
    repeat: true
    onTriggered: root.refresh()
  }

  IpcHandler {
    target: "io.github.shrijit37.omarchy-touchbar"

    function refresh(): void { root.refresh() }
    function status(): string { return root.label }
    function start(): void {
      if (!root.installed) root.install()
      else if (!root.running) starter.running = true
    }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.displayText
    labelVisible: !root.vertical
    hasVisualContent: true
    horizontalMargin: 8.75
    verticalPadding: 8.75
    tooltipText: root.tooltip
    active: !root.installed || !root.running
    activeColor: Color.accent
    foreground: root.bar ? root.bar.barForeground : Color.foreground

    onPressed: function(b) {
      if (b === Qt.RightButton) root.refresh()
      else if (!root.installed) root.install()
      else if (!root.running) starter.running = true
      else configProc.running = true  // running → open the config editor
    }

    Column {
      visible: root.vertical
      anchors.fill: parent

      OpticalGlyph {
        width: button.width
        height: Style.bar.iconSlot
        text: root.icon
        fontFamily: button.fontFamily
        fontSize: button.fontSize
        color: button.foreground
      }
    }
  }
}
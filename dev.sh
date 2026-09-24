#!/usr/bin/env bash
# Launch the Touch Bar control center in dev mode from this checkout.
#
# Stops the installed service (it owns the DRM card — dev and the service
# cannot run at once), ensures the native addon is built, then runs the same
# `npm run dev` (hot reload) you would otherwise start by hand.
# The red blinker (bar border + bar-widget dot) is on for the whole run.
set -euo pipefail
cd "$(dirname "$0")"

MARKER="$HOME/.local/state/omarchy-touchbar/dev.indicator"
PLUGIN_DIR="$HOME/.config/omarchy/plugins/io.github.shrijit37.omarchy-touchbar"

# ── prerequisites (before touching the running service, so a failed install
#    never leaves the bar dark) ────────────────────────────────────────────────
[ -d node_modules ] || { echo "[dev] installing dependencies"; npm ci; }
# dev loads TypeScript through tsx; only the native addon needs compiling
[ -f build/Release/drm_backend.node ] || { echo "[dev] building native addon"; npm run build:native; }

# ── service out of the way (it owns the DRM card) ─────────────────────────────
if systemctl --user is-active --quiet omarchy-touchbar.service; then
  systemctl --user stop omarchy-touchbar.service
  echo "[dev] stopped omarchy-touchbar.service"
fi

# the shell loads the widget from its own plugin clone, not this checkout
if [ -f "$PLUGIN_DIR/BarWidget.qml" ] && ! cmp -s BarWidget.qml "$PLUGIN_DIR/BarWidget.qml"; then
  cp BarWidget.qml "$PLUGIN_DIR/BarWidget.qml"
  echo "[dev] synced BarWidget.qml into the plugin clone"
fi

# ── dev-mode indicator ────────────────────────────────────────────────────────
mkdir -p "$(dirname "$MARKER")"
: > "$MARKER"

# The hint lives in the trap, not after `npm run dev`: Ctrl-C makes the child
# exit non-zero, and `set -e` would abort before a trailing echo ever ran.
cleanup() {
  trap - EXIT INT TERM   # a signal fires INT/TERM then EXIT; disarm so this runs once
  rm -f "$MARKER"
  echo
  echo "[dev] stopped. restore production with:"
  echo "  systemctl --user start omarchy-touchbar.service"
}
trap cleanup EXIT INT TERM

export OMARCHY_TOUCHBAR_DEV_INDICATOR=1

# not exec: the trap must fire to drop the marker when dev stops
npm run dev --workspace linux-touchbar-control-center

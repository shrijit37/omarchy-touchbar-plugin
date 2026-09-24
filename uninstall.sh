#!/usr/bin/env bash
#
# Removes the system integration installed by omarchy-touchbar.
# Project files, dependencies and user group memberships are left unchanged.
#
# Project: Omarchy Touch Bar — https://github.com/shrijit37/omarchy-touchbar-plugin
# Author: André Eikmeyer (dev@deqrocks)
# Upstream renderer: Muhammad Adel — https://github.com/dev-muhammad-adel/react-drm
# Date: 2026-06-14
#
# This script is provided without warranty. Use it at your own risk.
# The author and project contributors are not responsible for data loss,
# hardware damage, system failure, or any other consequences of its use.

set -Eeuo pipefail
shopt -s nullglob

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SERVICE_FILE="$HOME/.config/systemd/user/omarchy-touchbar.service"
LEGACY_SERVICE_FILE="$HOME/.config/systemd/user/react-drm.service"  # pre-rebrand name, same daemon
INSTALL_DIR="$HOME/.local/share/omarchy-touchbar"
UDEV_RULE="/etc/udev/rules.d/99-omarchy-touchbar.rules"
LEGACY_UDEV_RULE="/etc/udev/rules.d/99-omarchy-touchbar-uinput.rules"
CONFIG_GUI_LAUNCHER="$HOME/.local/share/applications/omarchy-touchbar-config.desktop"

GUI_MODE=0

json_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

gui_phase() {
  [[ $GUI_MODE -eq 1 ]] || return 0
  printf '{"type":"phase","name":"%s","status":"%s"}\n' "$1" "$2"
}

gui_ask() {
  printf '{"type":"question","kind":"%s"}\n' "$1"
  local line
  IFS= read -r line || fail "no answer received from the GUI"
  GUI_ANSWER=$(printf '%s' "$line" | sed -n 's/.*"answer" *: *"\([^"]*\)".*/\1/p')
}

privileged() {
  if [[ $GUI_MODE -eq 1 ]]; then pkexec "$@"; else sudo "$@"; fi
}

info(){
  if [[ $GUI_MODE -eq 1 ]]; then
    printf '{"type":"log","phase":"uninstall","level":"info","text":"%s"}\n' "$(json_escape "$*")"
  else
    printf '[uninstall] %s\n' "$*"
  fi
}
fail(){
  if [[ $GUI_MODE -eq 1 ]]; then
    printf '{"type":"error","phase":"uninstall","message":"%s"}\n' "$(json_escape "$1")"
  else
    printf '[uninstall] error: %s\n' "$1" >&2
  fi
  exit 1
}
on_error_trap() {
  local line=$1 cmd=$2
  if [[ $GUI_MODE -eq 1 ]]; then
    printf '{"type":"error","phase":"uninstall","message":"%s"}\n' "$(json_escape "line $line: $cmd")"
  else
    printf '[uninstall] fatal: line %s: %s\n' "$line" "$cmd" >&2
  fi
  exit 1
}
trap 'on_error_trap "$LINENO" "$BASH_COMMAND"' ERR

confirm_uninstall() {
  local answer cmd
  [[ $EUID -ne 0 ]] || fail "run this script as your regular user, not as root"
  for cmd in systemctl udevadm; do
    command -v "$cmd" >/dev/null 2>&1 || fail "required command is missing: $cmd"
  done
  systemctl --user show-environment >/dev/null ||
    fail "unable to connect to the systemd user manager"
  if [[ $GUI_MODE -eq 1 ]]; then
    # install-gui's Confirm screen already showed this disclosure and got
    # consent before spawning this process; nothing more to ask here.
    command -v pkexec >/dev/null 2>&1 || fail "pkexec is required for the graphical uninstaller"
    return
  fi
  command -v sudo >/dev/null 2>&1 || fail "required command is missing: sudo"
  cat <<'EOF'
This removes the omarchy-touchbar user service and udev rules and restores the
firmware Touch Bar interface.

Project files, npm dependencies, system packages and video/input group
memberships are not removed.
EOF
  printf '\nType UNINSTALL to continue, or anything else to cancel: '
  IFS= read -r answer || fail "uninstallation cancelled"
  [[ "$answer" == UNINSTALL ]] || fail "uninstallation cancelled"
  sudo -v || fail "unable to acquire administrative privileges"
}

control_center_running() {
  local proc cwd cmdline
  for proc in /proc/[0-9]*; do
    cwd=$(readlink "$proc/cwd" 2>/dev/null) || continue
    [[ "${cwd##*/}" == linux-touchbar-control-center ]] || continue
    cmdline=$(tr '\0' ' ' <"$proc/cmdline" 2>/dev/null) || continue
    [[ "$cmdline" == *index.tsx* ]] && return 0
  done
  return 1
}

remove_service() {
  if [[ -e "$SERVICE_FILE" ]] ||
    systemctl --user is-active --quiet omarchy-touchbar.service ||
    systemctl --user is-enabled --quiet omarchy-touchbar.service; then
    info "Stopping and disabling omarchy-touchbar.service"
    systemctl --user disable --now omarchy-touchbar.service
  fi
  systemctl --user is-active --quiet omarchy-touchbar.service &&
    fail "omarchy-touchbar.service did not stop"
  control_center_running &&
    fail "a manually started omarchy-touchbar control center is still running"

  info "Restoring the firmware Touch Bar interface"
  [[ -x "$SCRIPT_DIR/system/omarchy-touchbar-tb-detach" ]] ||
    fail "system/omarchy-touchbar-tb-detach is missing or not executable"
  "$SCRIPT_DIR/system/omarchy-touchbar-tb-detach" ||
    fail "unable to restore the firmware Touch Bar interface"

  rm -f "$SERVICE_FILE"
  # The pre-rebrand unit is the same daemon under the old name; drop it too.
  rm -f "$LEGACY_SERVICE_FILE"
  systemctl --user daemon-reload
}

remove_udev_rules() {
  info "Removing omarchy-touchbar udev rules"
  privileged rm -f "$UDEV_RULE" "$LEGACY_UDEV_RULE"
  privileged udevadm control --reload
  privileged udevadm trigger --action=add --subsystem-match=usb --subsystem-match=backlight
  privileged udevadm trigger --action=add --subsystem-match=misc --sysname-match=uinput
}

remove_install_dir() {
  if [[ ! -e "$INSTALL_DIR" ]]; then
    info "No installed files at $INSTALL_DIR"
    return
  fi
  info "Removing the installed copy at $INSTALL_DIR (project/repo files are kept)"
  rm -rf "$INSTALL_DIR"
}

remove_config_gui_launcher() {
  [[ -e "$CONFIG_GUI_LAUNCHER" ]] || return 0
  info "Removing config editor launcher"
  rm -f "$CONFIG_GUI_LAUNCHER"
}

launch_wizard() {
  [[ $EUID -ne 0 ]] || fail "run this script as your regular user, not as root"
  [[ -x "$SCRIPT_DIR/node_modules/.bin/electron" && -f "$SCRIPT_DIR/install-gui/dist/main/main.js" ]] ||
    fail "the graphical installer isn't built yet; run './install.sh wizard' once first, or use the terminal flow: ./uninstall.sh"
  info "Launching the graphical uninstaller"
  OMARCHY_TOUCHBAR_REPO_DIR="$SCRIPT_DIR" exec "$SCRIPT_DIR/node_modules/.bin/electron" "$SCRIPT_DIR/install-gui" --mode=uninstall
}

main() {
  case "${1:-uninstall}" in
    uninstall)
      [[ "${2:-}" == --gui ]] && GUI_MODE=1
      gui_phase uninstall start
      confirm_uninstall
      remove_service
      remove_udev_rules
      remove_config_gui_launcher
      remove_install_dir
      info "Uninstallation completed successfully"
      gui_phase uninstall done
      # `if`, not `[[ ]] &&`: under `set -Eeuo pipefail` a false `[[ ]]` as the
      # last statement of a case arm fires the ERR trap and exits 1 — a
      # successful plain `./uninstall.sh uninstall` reported failure.
      # install.sh:903 already uses this form.
      if [[ $GUI_MODE -eq 1 ]]; then
        printf '{"type":"done"}\n'
      fi
      ;;
    wizard) launch_wizard ;;
    *) printf 'usage: %s [uninstall|wizard]\n' "${0##*/}" >&2; return 2 ;;
  esac
}

main "$@"

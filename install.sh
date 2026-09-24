#!/usr/bin/env bash
#
# System integration of Omarchy Touch Bar
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
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$SCRIPT_DIR")"
# The daemon, the service and the config editor all run from this stable
# install dir, never from the repo/plugin checkout (which omarchy may replace
# on `plugin update`). The BarWidget probes
# "$INSTALL_DIR/linux-touchbar-control-center/dist/index.js".
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/omarchy-touchbar}"

readonly TOUCHBAR_VENDOR_ID="05ac"
readonly TOUCHBAR_PRODUCT_ID="8302"
readonly REQUIRED_TINY_DAEMONS=(tiny-dfr mac-touchbar-plus)
readonly COMMON_RUNTIME_PACKAGES=(brightnessctl cava)
# t2linux is the only supported Touch Bar driver stack (Omarchy/Arch).
readonly REQUIRED_KERNEL_MODULES=(appletbdrm hid-appletb-bl)

ANALYSIS_MISSING_COMMANDS=()
ANALYSIS_MISSING_MODULES=()
ANALYSIS_CONFLICTING_PACKAGES=()
ANALYSIS_CONFLICTING_PROCESSES=()
ANALYSIS_CONFLICTING_UNITS=()
ANALYSIS_TOUCHBAR_USB_DEVICES=()
ANALYSIS_TOUCHBAR_DRM_CARDS=()
ANALYSIS_MISSING_USER_GROUPS=()

OS_ID=""
OS_VERSION_ID=""
OS_PRETTY_NAME=""
OS_SIGNATURE=""
PKG_MANAGER=""

SESSION_TYPE=""
CURRENT_DESKTOP=""
SESSION_DESKTOP=""
WINDOW_BACKEND=""
DESKTOP_SUPPORTED=1
DESKTOP_ABORT_REASON=""
NEEDS_RELOGIN=0
DEPLOYMENT_MODE="new installation"

NEEDED_BUILD_PACKAGES=()
NEEDED_RUNTIME_PACKAGES=()
NEEDED_BACKEND_PACKAGES=()
NEEDED_PACKAGES=()
LOG_PHASE="install"

# GUI_MODE=1 switches info/warn/fail/analysis_*/privileged from plain
# terminal output + sudo to a line-delimited JSON event protocol on stdout
# (consumed by install-gui) + pkexec, without changing any detection,
# packaging, purge or deploy logic itself. Set only via `install --gui`,
# which is only ever invoked by install-gui's own child process spawn.
GUI_MODE=0

# ASSUME_YES=1 (--yes/-y) skips the typed yes/CONTINUE/PURGE confirmations.
# Detection still runs in full; only the interactive gates are bypassed.
ASSUME_YES=0
# t2linux is the only supported driver stack; named explicitly so the udev
# rules and .env seeding paths read the same as the dropped multi-profile form.
HARDWARE_PROFILE=t2linux

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

# Emits a question event and blocks for a one-line JSON answer on stdin,
# e.g. {"answer":"PURGE"}. install-gui always sends exactly that shape.
# Sets GUI_ANSWER rather than echoing it: callers must NOT wrap this in
# $(...) — that would run it in a subshell and swallow the question JSON
# into the captured output instead of writing it to the real stdout the
# GUI is reading, hanging the GUI forever waiting for a question it never saw.
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
    printf '{"type":"log","phase":"%s","level":"info","text":"%s"}\n' "$LOG_PHASE" "$(json_escape "$*")"
  else
    printf '[%s] %s\n' "$LOG_PHASE" "$*"
  fi
}
warn(){
  if [[ $GUI_MODE -eq 1 ]]; then
    printf '{"type":"log","phase":"%s","level":"warn","text":"%s"}\n' "$LOG_PHASE" "$(json_escape "$*")"
  else
    printf '[%s] warning: %s\n' "$LOG_PHASE" "$*" >&2
  fi
}
fail(){
  if [[ $GUI_MODE -eq 1 ]]; then
    printf '{"type":"error","phase":"%s","message":"%s"}\n' "$LOG_PHASE" "$(json_escape "$1")"
  else
    printf '[%s] error: %s\n' "$LOG_PHASE" "$1" >&2
  fi
  exit 1
}
on_error_trap() {
  local line=$1 cmd=$2
  if [[ $GUI_MODE -eq 1 ]]; then
    printf '{"type":"error","phase":"%s","message":"%s"}\n' "$LOG_PHASE" "$(json_escape "line $line: $cmd")"
  else
    printf '[%s] fatal: line %s: %s\n' "$LOG_PHASE" "$line" "$cmd" >&2
  fi
  exit 1
}
trap 'on_error_trap "$LINENO" "$BASH_COMMAND"' ERR

analysis_section() {
  if [[ $GUI_MODE -eq 1 ]]; then
    printf '{"type":"log","phase":"%s","level":"info","text":"%s"}\n' "$LOG_PHASE" "$(json_escape "$1")"
    return
  fi
  printf '\n[%s] %s\n' "$LOG_PHASE" "$1"
  printf '[%s] %s\n' "$LOG_PHASE" '------------------------------------------------------------'
}

analysis_value() {
  if [[ $GUI_MODE -eq 1 ]]; then
    printf '{"type":"log","phase":"%s","level":"info","text":"%s"}\n' "$LOG_PHASE" "$(json_escape "  $1: $2")"
    return
  fi
  printf '[%s]   %-24s %s\n' "$LOG_PHASE" "$1:" "$2"
}

confirm_installation() {
  local answer
  [[ $EUID -ne 0 ]] || fail "run this installer as your regular user, not as root"
  if [[ $GUI_MODE -eq 1 ]]; then
    # install-gui's Welcome screen already shows this disclosure and got
    # consent before spawning this process; nothing more to ask here.
    command -v pkexec >/dev/null 2>&1 || fail "pkexec is required for the graphical installer"
    return
  fi
  cat <<'EOF'
omarchy-touchbar replaces the existing Touch Bar interface.

The installation has three phases:

  1. Analysis
     Detect the distribution, desktop session, Touch Bar hardware, kernel
     modules and conflicting daemons. Dry-run the complete package transaction
     without changing the system. Verify that omarchy-touchbar can be installed and
     that detected conflicting daemons can be removed. The results are shown at
     the end of this phase.

  2. Purge
     There will be an explicit confirmation prompt before removing any of your
     current services or daemons.
     It will stop, disable and remove tiny-dfr or mac-touchbar-plus if present.
     The Touch Bar will use its firmware interface until omarchy-touchbar is deployed.

  3. Deploy
     Install build and runtime dependencies, build the current local omarchy-touchbar
     source, install or update its udev rules and systemd user service, and add
     your user to the video and input groups if required. If group memberships
     change, you must log out and back in after installation.

On Arch-based systems, only missing required packages are installed — the
repository metadata is not refreshed and no system upgrade is performed. If
package resolution fails because the system is stale, run `omarchy update`
(Omarchy blocks direct pacman upgrades) and run this installer again.

This installer does not download omarchy-touchbar source updates. To update an
existing installation, update the local omarchy-touchbar source using the same method
used to obtain it, then run install.sh from the updated source. The current
local source is rebuilt and the running service is restarted.

The Touch Bar may show only its firmware controls between the purge and a
successful deployment. Purge starts only after analysis and package resolution
have completed successfully. The installer stops without removing a Touch Bar
daemon if either check fails.

If the analysis produces incorrect results or the installer behaves
unexpectedly, stop the installation and report the problem at:
https://github.com/shrijit37/omarchy-touchbar-plugin/issues

This installer is provided without warranty and is used entirely at your own
risk. The author and project contributors are not responsible for data loss,
hardware damage, system failure, or any other consequences of its use.
EOF
  if [[ $ASSUME_YES -eq 1 ]]; then
    info "--yes supplied; skipping confirmation prompt"
  else
    while true; do
      printf '\nType yes to continue, or no to cancel. Press Ctrl+C to abort: '
      IFS= read -r answer || fail "installation cancelled"
      case "$answer" in
        yes) break ;;
        no) fail "installation cancelled" ;;
        *) warn "please type yes or no" ;;
      esac
    done
  fi
  command -v sudo >/dev/null 2>&1 || fail "sudo is required"
  info "Acquiring administrative privileges"
  sudo -v || fail "unable to acquire administrative privileges"
}

confirm_purge() {
  local answer
  LOG_PHASE=purge
  gui_phase purge start
  if [[ ${#ANALYSIS_CONFLICTING_UNITS[@]} -eq 0 &&
        ${#ANALYSIS_CONFLICTING_PACKAGES[@]} -eq 0 &&
        ${#ANALYSIS_CONFLICTING_PROCESSES[@]} -eq 0 ]]; then
    if [[ $GUI_MODE -eq 1 ]]; then
      gui_ask continue
      [[ "$GUI_ANSWER" == CONTINUE ]] || fail "installation cancelled before deployment"
      return
    fi
    if [[ $ASSUME_YES -eq 1 ]]; then
      info "--yes supplied; skipping deployment confirmation"
      return
    fi
    cat <<'EOF'

Analysis and package resolution completed successfully.

No conflicting Touch Bar daemon was detected, so the purge phase will not
remove anything. The next phase installs dependencies and deploys omarchy-touchbar.
EOF
    while true; do
      printf '\nType CONTINUE to start deployment, or no to cancel: '
      IFS= read -r answer || fail "installation cancelled before deployment"
      case "$answer" in
        CONTINUE) return ;;
        no) fail "installation cancelled before deployment" ;;
        *) warn "please type CONTINUE or no" ;;
      esac
    done
  fi

  if [[ $GUI_MODE -eq 1 ]]; then
    gui_ask purge
    [[ "$GUI_ANSWER" == PURGE ]] || fail "installation cancelled before purge"
    return
  fi
  if [[ $ASSUME_YES -eq 1 ]]; then
    info "--yes supplied; skipping purge confirmation (the conflicts listed above will be removed)"
    return
  fi

  cat <<'EOF'

Analysis and package resolution completed successfully.

The next phase stops, disables and removes every detected tiny-dfr or
mac-touchbar-plus installation. Package removal is destructive and this
installer cannot automatically restore the previous Touch Bar setup.

Review the analysis summary above before continuing.
EOF
  while true; do
    printf '\nType PURGE to remove conflicting Touch Bar daemons, or no to cancel: '
    IFS= read -r answer || fail "installation cancelled before purge"
    case "$answer" in
      PURGE) return ;;
      no) fail "installation cancelled before purge" ;;
      *) warn "please type PURGE or no" ;;
    esac
  done
}

source_os_release() {
  [[ -r /etc/os-release ]] || { fail "/etc/os-release is missing"; return; }
  # shellcheck disable=SC1091
  . /etc/os-release
  OS_ID=${ID:-}
  OS_VERSION_ID=${VERSION_ID:-}
  OS_PRETTY_NAME=${PRETTY_NAME:-${NAME:-unknown}}
  OS_SIGNATURE="${OS_ID} ${OS_PRETTY_NAME}"
  OS_SIGNATURE="${OS_SIGNATURE,,}"
}

detect_pkg_manager() {
  case "$OS_SIGNATURE" in
    *arch*|*cachy*|*endeavouros*|*manjaro*) PKG_MANAGER=pacman ;;
    *) PKG_MANAGER="" ;;
  esac
}

detect_session() {
  SESSION_TYPE=${XDG_SESSION_TYPE:-}
  CURRENT_DESKTOP=${XDG_CURRENT_DESKTOP:-}
  SESSION_DESKTOP=${DESKTOP_SESSION:-}
  if [[ -z "$SESSION_TYPE" && -n "${WAYLAND_DISPLAY:-}" ]]; then
    SESSION_TYPE=wayland
  elif [[ -z "$SESSION_TYPE" && -n "${DISPLAY:-}" ]]; then
    SESSION_TYPE=x11
  fi
  if [[ "$SESSION_TYPE" == x11 ]]; then
    WINDOW_BACKEND=xorg
    return
  fi
  if [[ "$SESSION_TYPE" != wayland ]]; then
    DESKTOP_SUPPORTED=0
    DESKTOP_ABORT_REASON="unable to detect an Xorg or Wayland session"
    return
  fi
  case "${CURRENT_DESKTOP,,} ${SESSION_DESKTOP,,}" in
    *gnome*) WINDOW_BACKEND=gnome ;;
    *kde*|*plasma*) WINDOW_BACKEND=plasma ;;
    *hyprland*) WINDOW_BACKEND=hyprland ;;
    *niri*) WINDOW_BACKEND=niri ;;
    *) WINDOW_BACKEND=unsupported; DESKTOP_SUPPORTED=0; DESKTOP_ABORT_REASON="no active-window backend exists for this Wayland desktop" ;;
  esac
}

detect_touchbar_hardware() {
  local dev card found=0
  for dev in /sys/bus/usb/devices/*; do
    [[ -r "$dev/idVendor" && -r "$dev/idProduct" ]] || continue
    [[ "$(cat "$dev/idVendor")" == "$TOUCHBAR_VENDOR_ID" && "$(cat "$dev/idProduct")" == "$TOUCHBAR_PRODUCT_ID" ]] || continue
    ANALYSIS_TOUCHBAR_USB_DEVICES+=("$dev"); found=1
  done
  [[ $found -eq 1 ]] || fail "Touch Bar hardware (05ac:8302) not found"
  for card in /sys/class/drm/card*; do
    [[ -e "$card/device/uevent" ]] || continue
    if grep -qE 'DRIVER=appletbdrm' "$card/device/uevent" 2>/dev/null; then
      ANALYSIS_TOUCHBAR_DRM_CARDS+=("$card")
    fi
  done
}

detect_required_commands() {
  local cmd
  local privilege_cmd=sudo
  [[ $GUI_MODE -eq 1 ]] && privilege_cmd=pkexec
  for cmd in "$privilege_cmd" systemctl systemd-analyze udevadm modinfo getent; do command -v "$cmd" >/dev/null 2>&1 || ANALYSIS_MISSING_COMMANDS+=("$cmd"); done
  command -v pacman >/dev/null 2>&1 || ANALYSIS_MISSING_COMMANDS+=("pacman")
}

detect_user_groups() {
  local group
  for group in video input; do
    getent group "$group" >/dev/null || fail "required group does not exist: $group"
    if ! id -nG "$USER" | tr ' ' '\n' | grep -Fxq "$group"; then
      ANALYSIS_MISSING_USER_GROUPS+=("$group")
      NEEDS_RELOGIN=1
    elif ! id -nG | tr ' ' '\n' | grep -Fxq "$group"; then
      NEEDS_RELOGIN=1
    fi
  done
}

check_deploy_files() {
  local file
  [[ -w "$REPO_ROOT" ]] || fail "repository is not writable: $REPO_ROOT"
  # 99-omarchy-touchbar.rules is generated (gitignored): the profile's rules
  # file is copied into the canonical name the service steps use.
  cp -f "$REPO_ROOT/system/99-omarchy-touchbar-$HARDWARE_PROFILE.rules" "$REPO_ROOT/system/99-omarchy-touchbar.rules"
  for file in package.json package-lock.json system/99-omarchy-touchbar.rules system/omarchy-touchbar.service system/omarchy-touchbar-tb-detach; do
    [[ -r "$REPO_ROOT/$file" ]] || fail "required deployment file is missing or unreadable: $file"
  done
  [[ -x "$REPO_ROOT/system/omarchy-touchbar-tb-detach" ]] ||
    fail "required deployment helper is not executable: system/omarchy-touchbar-tb-detach"
  udevadm verify "$REPO_ROOT/system/99-omarchy-touchbar.rules" >/dev/null ||
    fail "the supplied udev rules are invalid"
  if [[ -e "$HOME/.config/systemd/user/omarchy-touchbar.service" ]]; then
    DEPLOYMENT_MODE="update existing installation"
  fi
}

detect_kernel_modules() {
  local module
  for module in "${REQUIRED_KERNEL_MODULES[@]}"; do
    modinfo "$module" >/dev/null 2>&1 || ANALYSIS_MISSING_MODULES+=("$module")
  done
}

unit_file_exists() {
  local scope=$1 unit=$2 output status
  if [[ "$scope" == system ]]; then
    if output=$(systemctl list-unit-files --no-legend "$unit" 2>&1); then
      [[ -n "$output" ]]
      return
    else
      status=$?
    fi
  else
    if output=$(systemctl --user list-unit-files --no-legend "$unit" 2>&1); then
      [[ -n "$output" ]]
      return
    else
      status=$?
    fi
  fi
  if [[ $status -eq 1 && -z "$output" ]]; then
    return 1
  fi
  fail "unable to inspect $scope unit $unit: ${output:-exit status $status}"
}

detect_conflicts() {
  local pkg proc unit scope processes status
  ANALYSIS_CONFLICTING_PACKAGES=()
  ANALYSIS_CONFLICTING_PROCESSES=()
  ANALYSIS_CONFLICTING_UNITS=()
  for pkg in "${REQUIRED_TINY_DAEMONS[@]}"; do
    pkg_installed "$pkg" && ANALYSIS_CONFLICTING_PACKAGES+=("$pkg")
    if processes=$(pgrep -af "(^|/)${pkg}([[:space:]]|$)" 2>&1); then
      while IFS= read -r proc; do
        [[ -n "$proc" ]] && ANALYSIS_CONFLICTING_PROCESSES+=("$proc")
      done <<<"$processes"
    else
      status=$?
      [[ $status -eq 1 ]] || fail "unable to inspect running processes: ${processes:-exit status $status}"
    fi
    unit="${pkg}.service"
    for scope in system user; do
      if unit_file_exists "$scope" "$unit"; then
        ANALYSIS_CONFLICTING_UNITS+=("${scope}:${unit}")
      fi
    done
  done
}

pkg_installed() {
  pacman -Q "$1" >/dev/null 2>&1
}

detect_package_sets() {
  NEEDED_RUNTIME_PACKAGES=("${COMMON_RUNTIME_PACKAGES[@]}")
  NEEDED_BACKEND_PACKAGES=()
  NEEDED_BUILD_PACKAGES=(nodejs npm python gcc make pkgconf systemd libdrm cairo librsvg)
  if [[ "$WINDOW_BACKEND" == xorg ]]; then
    NEEDED_BACKEND_PACKAGES=(xorg-xprop)
  fi
  NEEDED_PACKAGES=("${NEEDED_BUILD_PACKAGES[@]}" "${NEEDED_RUNTIME_PACKAGES[@]}" "${NEEDED_BACKEND_PACKAGES[@]}")
}

check_node_version() {
  local version
  version=$(pacman -Si nodejs 2>/dev/null | awk -F ': ' '/^Version/ { print $2; exit }')
  [[ -n "$version" ]] || fail "no Node.js candidate is available"
}

dry_run_packages() {
  local output pkg
  local -a missing
  info "Resolving the package transaction"
  # Resolve only what is missing. Targeting already-installed packages makes
  # a stale sync db fail on exact version pins (e.g. systemd-sysvcompat
  # wanting the installed systemd while the db still ships an older one)
  # even though nothing needs to change for them. Never -Sy/-Syu here:
  # Omarchy's ALPM guard blocks upgrades and the user chose no side effects.
  missing=()
  for pkg in "${NEEDED_PACKAGES[@]}"; do
    pkg_installed "$pkg" || missing+=("$pkg")
  done
  if [[ ${#missing[@]} -eq 0 ]]; then
    info "All required packages are already installed"
    info "Package transaction resolved successfully"
    return
  fi
  if output=$(LC_ALL=C pacman -Sp --needed --print-format '%n' "${missing[@]}" 2>&1); then
    info "Package transaction resolved successfully"
    return
  fi
  printf '%s\n' "$output" >&2
  if [[ -e /usr/share/libalpm/hooks/00-omarchy-update-guard.hook ]]; then
    fail "the package database is stale; run 'omarchy update', then re-run this installer"
  fi
  fail "the required package transaction cannot be resolved"
}

print_analysis() {
  local proc

  analysis_section "Environment"
  analysis_value "Repository" "$REPO_ROOT"
  analysis_value "Operating system" "${OS_PRETTY_NAME:-unknown} (${OS_ID:-unknown})"
  analysis_value "Package manager" "${PKG_MANAGER:-unknown}"
  analysis_value "Session" "${SESSION_TYPE:-unknown} / ${CURRENT_DESKTOP:-unknown} / ${SESSION_DESKTOP:-unknown}"
  analysis_value "Window backend" "${WINDOW_BACKEND:-unknown}"

  analysis_section "Hardware"
  analysis_value "Hardware profile" "${HARDWARE_PROFILE:-unknown}"
  analysis_value "Touch Bar USB devices" "${#ANALYSIS_TOUCHBAR_USB_DEVICES[@]}"
  analysis_value "Touch Bar DRM cards" "${#ANALYSIS_TOUCHBAR_DRM_CARDS[@]}"
  analysis_value "Kernel modules" "${REQUIRED_KERNEL_MODULES[*]}"

  analysis_section "Packages"
  analysis_value "Build dependencies" "${NEEDED_BUILD_PACKAGES[*]:-none}"
  analysis_value "Runtime dependencies" "${NEEDED_RUNTIME_PACKAGES[*]:-none}"
  analysis_value "Backend dependencies" "${NEEDED_BACKEND_PACKAGES[*]:-none}"

  analysis_section "Planned Changes"
  analysis_value "Deployment mode" "$DEPLOYMENT_MODE"
  analysis_value "Source operation" "build current repository; no source download"
  analysis_value "User groups to add" "${ANALYSIS_MISSING_USER_GROUPS[*]:-none}"
  analysis_value "Packages to purge" "${ANALYSIS_CONFLICTING_PACKAGES[*]:-none}"
  analysis_value "Units to disable" "${ANALYSIS_CONFLICTING_UNITS[*]:-none}"
  analysis_value "Conflicting processes" "${#ANALYSIS_CONFLICTING_PROCESSES[@]}"

  [[ $NEEDS_RELOGIN -eq 0 ]] || warn "A logout and login will be required before omarchy-touchbar can start"
  if [[ ${#ANALYSIS_CONFLICTING_PROCESSES[@]} -gt 0 ]]; then
    for proc in "${ANALYSIS_CONFLICTING_PROCESSES[@]}"; do
      printf '[%s]     %s\n' "$LOG_PHASE" "$proc"
    done
  fi
}

analyze() {
  LOG_PHASE=analysis
  gui_phase analysis start
  [[ $EUID -ne 0 ]] || fail "run this installer as your regular user, not as root"
  source_os_release
  detect_pkg_manager
  detect_session
  if [[ $DESKTOP_SUPPORTED -eq 0 ]]; then
    fail "$DESKTOP_ABORT_REASON; omarchy-touchbar currently supports GNOME, Plasma, Hyprland and Niri on Wayland, plus Xorg"
  fi
  [[ -n "$PKG_MANAGER" ]] || fail "omarchy-touchbar supports Arch-family distributions only (including Omarchy): ${OS_PRETTY_NAME:-unknown}"
  detect_required_commands
  [[ ${#ANALYSIS_MISSING_COMMANDS[@]} -eq 0 ]] || fail "missing required commands: ${ANALYSIS_MISSING_COMMANDS[*]}"
  detect_kernel_modules
  [[ ${#ANALYSIS_MISSING_MODULES[@]} -eq 0 ]] || fail "missing T2 kernel modules: ${ANALYSIS_MISSING_MODULES[*]}"
  check_deploy_files
  detect_user_groups
  detect_package_sets
  check_node_version
  detect_touchbar_hardware
  detect_conflicts
  print_analysis
  dry_run_packages
  analysis_section "Result"
  analysis_value "Analysis" "successful"
  analysis_value "Package transaction" "resolved successfully"
  gui_phase analysis done
}

phase_purge() {
  local entry scope unit
  LOG_PHASE=purge

  if [[ ${#ANALYSIS_CONFLICTING_UNITS[@]} -eq 0 &&
        ${#ANALYSIS_CONFLICTING_PACKAGES[@]} -eq 0 &&
        ${#ANALYSIS_CONFLICTING_PROCESSES[@]} -eq 0 ]]; then
    info "No conflicting Touch Bar daemon found"
    gui_phase purge done
    return
  fi

  for entry in "${ANALYSIS_CONFLICTING_UNITS[@]}"; do
    scope=${entry%%:*}
    unit=${entry#*:}
    info "Disabling $scope unit $unit"
    if [[ "$scope" == system ]]; then
      privileged systemctl disable --now "$unit"
    else
      systemctl --user disable --now "$unit"
    fi
  done

  if [[ ${#ANALYSIS_CONFLICTING_PACKAGES[@]} -gt 0 ]]; then
    info "Removing packages: ${ANALYSIS_CONFLICTING_PACKAGES[*]}"
    privileged pacman -Rns --noconfirm "${ANALYSIS_CONFLICTING_PACKAGES[@]}"
    privileged systemctl daemon-reload
    systemctl --user daemon-reload
  fi

  detect_conflicts
  [[ ${#ANALYSIS_CONFLICTING_PACKAGES[@]} -eq 0 ]] ||
    fail "conflicting packages remain installed: ${ANALYSIS_CONFLICTING_PACKAGES[*]}"
  [[ ${#ANALYSIS_CONFLICTING_UNITS[@]} -eq 0 ]] ||
    fail "conflicting units remain installed: ${ANALYSIS_CONFLICTING_UNITS[*]}"
  [[ ${#ANALYSIS_CONFLICTING_PROCESSES[@]} -eq 0 ]] ||
    fail "a conflicting daemon is still running; stop the manual installation and retry"

  info "Conflicting Touch Bar daemons removed"
  gui_phase purge done
}

systemd_escape_path() {
  local value=$1
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] ||
    fail "repository paths containing line breaks are not supported"
  value=${value//\\/\\x5c}
  value=${value//$'\t'/\\x09}
  value=${value// /\\x20}
  value=${value//\"/\\x22}
  value=${value//\'/\\x27}
  value=${value//%/%%}
  printf '%s' "$value"
}

install_dependencies() {
  local pkg
  local -a missing
  info "Installing build and runtime dependencies"
  # Same missing-only targeting as dry_run_packages: against a stale sync db,
  # naming already-installed packages can fail the whole transaction.
  missing=()
  for pkg in "${NEEDED_PACKAGES[@]}"; do
    pkg_installed "$pkg" || missing+=("$pkg")
  done
  if [[ ${#missing[@]} -eq 0 ]]; then
    info "All required packages are already installed"
  else
    privileged pacman -S --needed --noconfirm "${missing[@]}"
  fi
  command -v node >/dev/null 2>&1 || fail "Node.js is unavailable after package installation"
  command -v npm >/dev/null 2>&1 || fail "npm is unavailable after package installation"
}

seed_user_config() {
  local blueprint="$INSTALL_DIR/linux-touchbar-control-center/config.blueprint.ts"
  local live="$INSTALL_DIR/linux-touchbar-control-center/config.ts"
  if [[ ! -e "$live" ]]; then
    info "Seeding editable config from the blueprint"
    cp "$blueprint" "$live"
  fi
}

# Seed the detected hardware profile into $INSTALL_DIR/.env, which the systemd
# service loads via EnvironmentFile (see system/omarchy-touchbar.service). Never
# overwrite an existing .env — the app treats it as user-editable config. A
# previous repo-root .env is carried forward so pre-deploy edits are not lost.
seed_distro_env() {
  local example="$REPO_ROOT/.env.example.${HARDWARE_PROFILE:-t2linux}"
  local live="$INSTALL_DIR/.env"
  if [[ -f "$REPO_ROOT/.env" && "$REPO_ROOT/.env" != "$live" ]]; then
    info "Carrying existing $REPO_ROOT/.env to $live"
    cp -f "$REPO_ROOT/.env" "$live"
    return
  fi
  if [[ -e "$live" ]]; then
    info "Keeping existing $live"
    return
  fi
  info "Seeding $live from $example"
  cp "$example" "$live"
}

# Deploys the built tree to the stable install dir. The daemon's production
# entry is `node dist/index.js`, which imports the workspace package
# omarchy-touchbar (dist/src/*) and, via load-addon, the native addon built by
# node-gyp at ${REPO_ROOT}/build/Release/drm_backend.node. The systemd service,
# the config editor and the BarWidget probe all operate on $INSTALL_DIR, so it
# must carry: the control-center workspace (dist/, config.ts, assets/), the
# root build/, the root dist/, .env, the detach helper — and a REAL
# node_modules/omarchy-touchbar directory so the daemon is self-contained
# (the repo's root node_modules/omarchy-touchbar is only a `..` workspace
# symlink that resolves back to the repo). node_modules is otherwise NOT
# copied wholesale — npm workspaces leave symlinks in it that omarchy plugin
# validate rejects.
deploy_to_install_dir() {
  info "Deploying to $INSTALL_DIR"
  install -d -m 0755 "$INSTALL_DIR"
  # Sources carry a trailing slash: rsync must copy their CONTENTS into the
  # destination, not the directory itself (without it, dest/build/build/ etc.
  # nests one level too deep and seed_user_config cannot find the blueprint).
  # --delete makes reruns self-healing against any previously nested copies.
  # config.ts and custom-layer.json are EXCLUDED from the delete: both are
  # gitignored (they exist only in the user's install dir, never in a fresh
  # checkout), so --delete would wipe the user's saved config on every re-install
  # and seed_user_config would silently re-seed blueprint defaults over it. Same
  # reasoning as seed_distro_env's "never overwrite an existing .env".
  rsync -a --delete "$REPO_ROOT/build/" "$INSTALL_DIR/build/"                        # native addon, stale-cleaned
  rsync -a --delete --exclude 'config.ts' --exclude 'custom-layer.json' \
                    "$REPO_ROOT/linux-touchbar-control-center/" \
                    "$INSTALL_DIR/linux-touchbar-control-center/"                    # daemon workspace (dist/, assets/)
  rsync -a --delete "$REPO_ROOT/dist/" "$INSTALL_DIR/dist/" || true                  # root dist/src/*, mirror (pure build output)
  seed_user_config
  seed_distro_env
  install -Dm 0755 "$REPO_ROOT/system/omarchy-touchbar-tb-detach" \
                   "$INSTALL_DIR/system/omarchy-touchbar-tb-detach"
  # Full dep tree: the daemon needs the whole hoisted closure (react-reconciler,
  # jotai, ws, yoga, native-addon JS …). This dir is a plain data dir — omarchy
  # plugin validate only ever inspects the plugin/repo folder, so the workspace
  # symlinks are harmless here and cheaper to copy whole than to re-derive per
  # package. Reruns rsync deltas only.
  rsync -a --delete "$REPO_ROOT/node_modules/" "$INSTALL_DIR/node_modules/"
  # The root package link ("..") is replaced by the real vendor copy below; the
  # two install-time tooling links would dangle forever (never deployed).
  rm -f "$INSTALL_DIR/node_modules/omarchy-touchbar" \
        "$INSTALL_DIR/node_modules/config-gui" \
        "$INSTALL_DIR/node_modules/install-gui"
  # Self-contained vendor package: the control-center's require("omarchy-touchbar")
  # resolves via its node_modules search path; a real directory here (not the repo's
  # `..` symlink) keeps the deploy independent of the plugin/repo location.
  install -d -m 0755 "$INSTALL_DIR/node_modules/omarchy-touchbar"
  rsync -a --delete "$REPO_ROOT/dist/" "$INSTALL_DIR/node_modules/omarchy-touchbar/dist/"
  rsync -a --delete "$REPO_ROOT/build/" "$INSTALL_DIR/node_modules/omarchy-touchbar/build/"
  cp -f "$REPO_ROOT/package.json" "$INSTALL_DIR/node_modules/omarchy-touchbar/package.json"
  # The config editor: install the built app so the desktop entry and the bar
  # widget can launch it (configEngine resolves config.ts under
  # $INSTALL_DIR/linux-touchbar-control-center by default). electron's real
  # binary ships inside the node_modules mirror via build_project's install
  # step; the .bin/electron shim in the mirror runs this app dir.
  rsync -a --delete "$REPO_ROOT/config-gui/" "$INSTALL_DIR/config-gui/"
}

build_project() {
  info "Installing npm dependencies"
  (cd "$REPO_ROOT" && npm ci)
  # electron's dist/ binary is filled by its postinstall; ensure it ran (npm may
  # skip scripts or a network hiccup), so the node_modules mirror ships a real
  # binary instead of the placeholder package.
  (cd "$REPO_ROOT" && node node_modules/electron/install.js) 2>/dev/null || true
  info "Building omarchy-touchbar and the control center"
  (cd "$REPO_ROOT/linux-touchbar-control-center" && npm run build)
  info "Building the config editor"
  (cd "$REPO_ROOT/config-gui" && npm run build)
}

install_config_gui_launcher() {
  info "Installing config editor launcher"
  local apps_dir="$HOME/.local/share/applications"
  install -d -m 0755 "$apps_dir"
  # The template uses `%h/.local/share/omarchy-touchbar` as a placeholder (systemd-style; it is
  # NOT a valid Desktop Entry field code, so it must be rewritten here —
  # launchers such as Vicinae and gio otherwise fail to expand it and the
  # entry's Exec= points at a nonexistent path). Rewrite it to the actual
  # install dir, like install_user_service() does for omarchy-touchbar.service. Only
  # Exec=/TryExec= lines are touched, so placeholder mentions in comments
  # stay intact.
  sed -E '/^(Exec|TryExec)=/ s|%h/.local/share/omarchy-touchbar|'"$INSTALL_DIR"'|g' \
    "$REPO_ROOT/system/omarchy-touchbar-config.desktop" \
    > "$apps_dir/omarchy-touchbar-config.desktop"
  chmod 0644 "$apps_dir/omarchy-touchbar-config.desktop"
}

phase_gui_bootstrap() {
  LOG_PHASE=gui
  [[ $EUID -ne 0 ]] || fail "run this installer as your regular user, not as root"
  source_os_release
  detect_pkg_manager
  [[ -n "$PKG_MANAGER" ]] || fail "omarchy-touchbar supports Arch-family distributions only (including Omarchy): ${OS_PRETTY_NAME:-unknown}"
  detect_required_commands
  [[ ${#ANALYSIS_MISSING_COMMANDS[@]} -eq 0 ]] || fail "missing required commands: ${ANALYSIS_MISSING_COMMANDS[*]}"
  check_node_version
  detect_package_sets

  cat <<'EOF'
This installs Node.js and the native build toolchain needed to open the
graphical installer window. Nothing else changes yet: the same disclosure,
analysis and confirmation prompts you'd see on the command line run next,
inside that window, before anything is purged or deployed.
EOF
  local answer
  while true; do
    printf '\nType yes to continue, or no to cancel: '
    IFS= read -r answer || fail "cancelled"
    case "$answer" in
      yes) break ;;
      no) fail "cancelled" ;;
      *) warn "please type yes or no" ;;
    esac
  done
  command -v sudo >/dev/null 2>&1 || fail "sudo is required"
  sudo -v || fail "unable to acquire administrative privileges"

  install_dependencies
  info "Installing npm dependencies"
  (cd "$REPO_ROOT" && npm ci)
  info "Building the graphical installer"
  (cd "$REPO_ROOT/install-gui" && npm run build)
  info "Launching the graphical installer"
  OMARCHY_TOUCHBAR_REPO_DIR="$REPO_ROOT" exec "$REPO_ROOT/node_modules/.bin/electron" "$REPO_ROOT/install-gui" --mode=install
}

configure_user_groups() {
  local groups
  if [[ ${#ANALYSIS_MISSING_USER_GROUPS[@]} -gt 0 ]]; then
    info "Adding $USER to groups: ${ANALYSIS_MISSING_USER_GROUPS[*]}"
    groups=$(IFS=,; printf '%s' "${ANALYSIS_MISSING_USER_GROUPS[*]}")
    privileged usermod -aG "$groups" "$USER"
    NEEDS_RELOGIN=1
  fi
}

install_udev_rules() {
  info "Installing udev rules"
  privileged install -m 0644 "$REPO_ROOT/system/99-omarchy-touchbar.rules" /etc/udev/rules.d/99-omarchy-touchbar.rules
  privileged udevadm control --reload
  privileged udevadm trigger --action=add --subsystem-match=usb --subsystem-match=backlight
  privileged udevadm trigger --action=add --subsystem-match=misc --sysname-match=uinput
}

install_user_service() {
  local service_dir service_file temporary_file workdir_q start_q detach_q envfile_q
  service_dir="$HOME/.config/systemd/user"
  service_file="$service_dir/omarchy-touchbar.service"
  workdir_q=$(systemd_escape_path "$INSTALL_DIR/linux-touchbar-control-center")
  start_q=$(systemd_escape_path "$INSTALL_DIR/linux-touchbar-control-center/dist/index.js")
  detach_q=$(systemd_escape_path "$INSTALL_DIR/system/omarchy-touchbar-tb-detach")
  envfile_q=$(systemd_escape_path "$INSTALL_DIR/.env")

  info "Installing systemd user service"
  install -d -m 0755 "$service_dir"
  temporary_file=$(mktemp --suffix=.service "$service_dir/omarchy-touchbar-install.XXXXXX")
  if ! awk -v workdir="$workdir_q" -v start="$start_q" -v detach="$detach_q" -v envfile="$envfile_q" '
    /^WorkingDirectory=/ { print "WorkingDirectory=" workdir; next }
    /^EnvironmentFile=/ { print "EnvironmentFile=-" envfile; next }
    /^ExecStart=/ { print "ExecStart=node " start; next }
    /^ExecStopPost=/ { print "ExecStopPost=-" detach; next }
    { print }
  ' "$REPO_ROOT/system/omarchy-touchbar.service" >"$temporary_file"; then
    rm -f "$temporary_file"
    fail "unable to generate the systemd user service"
  fi
  chmod 0644 "$temporary_file"
  if ! systemd-analyze --user verify "$temporary_file"; then
    rm -f "$temporary_file"
    fail "the generated systemd user service is invalid"
  fi
  if systemctl --user is-active --quiet omarchy-touchbar.service; then
    info "Stopping the existing omarchy-touchbar service"
    systemctl --user stop omarchy-touchbar.service
    if systemctl --user is-active --quiet omarchy-touchbar.service; then
      rm -f "$temporary_file"
      fail "the existing omarchy-touchbar service did not stop"
    fi
  fi
  mv -f "$temporary_file" "$service_file"
  systemctl --user daemon-reload
  # A previous crash-loop may have tripped the start rate limit; without
  # clearing the failed state and start counter, enable --now is refused.
  systemctl --user reset-failed omarchy-touchbar.service 2>/dev/null || true

  if [[ $NEEDS_RELOGIN -eq 1 ]]; then
    systemctl --user enable omarchy-touchbar.service
    warn "omarchy-touchbar is enabled but was not started; log out and back in to activate the new group memberships"
  else
    systemctl --user enable --now omarchy-touchbar.service
    sleep 2
    systemctl --user is-active --quiet omarchy-touchbar.service ||
      fail "omarchy-touchbar failed to remain active; inspect it with 'journalctl --user -u omarchy-touchbar.service -b'"
    info "omarchy-touchbar service started"
  fi
}

# The repo doubles as the omarchy plugin folder (manifest.json + BarWidget.qml
# live at its root), so it must stay validatable: `omarchy plugin update` runs
# `omarchy plugin validate` after every merge and rolls back on failure, and the
# validator rejects any symlink except .git — which is exactly what npm ci
# leaves behind (workspace links, .bin links). Everything production needs was
# already deployed to $INSTALL_DIR, so wipe the build-time node_modules trees
# and gate the install on a clean validation. Skipped where omarchy doesn't
# exist or when the folder carries no manifest.
finalize_plugin_folder() {
  [[ -f "$REPO_ROOT/manifest.json" ]] || return 0
  info "Cleaning build-time node_modules from the plugin folder"
  find "$REPO_ROOT" -name node_modules -type d -prune -exec rm -rf {} +
  if command -v omarchy >/dev/null 2>&1; then
    info "Validating the plugin folder"
    omarchy plugin validate "$REPO_ROOT" ||
      fail "plugin validation failed; the plugin folder must stay clean for 'omarchy plugin update'"
  fi
}

phase_deploy() {
  LOG_PHASE=deploy
  gui_phase deploy start
  # Stop first — unconditionally: a crash-looping or start-limit-hit unit is
  # failed/activating, so an is-active check would skip this and let the daemon
  # re-exec while its files are being replaced underneath it.
  systemctl --user stop omarchy-touchbar.service 2>/dev/null || true
  info "Deployment mode: $DEPLOYMENT_MODE"
  info "Building and deploying current repository: $REPO_ROOT"
  install_dependencies
  build_project
  deploy_to_install_dir
  configure_user_groups
  install_udev_rules
  install_user_service
  install_config_gui_launcher
  finalize_plugin_folder
  info "Deployment completed successfully"
  if [[ $NEEDS_RELOGIN -eq 1 ]]; then
    warn "Log out of the desktop session and log back in to activate the video and input group memberships"
    warn "omarchy-touchbar will start automatically after the next login"
  else
    info "omarchy-touchbar is active; no logout is required"
  fi
  gui_phase deploy done
  if [[ $GUI_MODE -eq 1 ]]; then
    printf '{"type":"done","needsRelogin":%s}\n' "$([[ $NEEDS_RELOGIN -eq 1 ]] && printf true || printf false)"
  fi
}

main() {
  local cmd="${1:-install}"
  if [[ $# -gt 0 ]]; then
    if [[ "$1" == -* ]]; then
      cmd=install   # flags-first: default to install
    else
      shift
    fi
  fi
  case "$cmd" in
    install|analyze|purge|wizard) ;;
    *) printf 'usage: %s [install|analyze|purge|wizard] [--gui] [--yes|-y]\n' "${0##*/}"; exit 2 ;;
  esac
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --gui)
        # Only the install-gui child ever passes this (see GUI_MODE above).
        [[ $cmd == install ]] || { printf '%s: --gui is only valid for install\n' "${0##*/}" >&2; exit 2; }
        GUI_MODE=1 ;;
      --yes|-y) ASSUME_YES=1 ;;
      *) printf '%s: unknown option: %s\n' "${0##*/}" "$1" >&2; exit 2 ;;
    esac
    shift
  done
  case "$cmd" in
    install) confirm_installation; analyze; confirm_purge; phase_purge; phase_deploy ;;
    analyze) analyze ;;
    purge) confirm_installation; analyze; confirm_purge; phase_purge ;;
    wizard) phase_gui_bootstrap ;;
  esac
}

main "$@"

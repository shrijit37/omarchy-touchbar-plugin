#!/usr/bin/env bash
# Test double for install.sh / uninstall.sh.
#
# Speaks the same `--gui` line-delimited JSON protocol the real scripts emit
# (install.sh: gui_phase/info/warn/fail/on_error_trap/gui_ask) so install-gui
# can be exercised without T2 hardware, without a distro, and without mutating
# anything. It never touches the system.
#
# Pick a behaviour with STUB_SCENARIO (default: success). See ../harness.sh.

set -uo pipefail

LOG_PHASE=analysis
SCENARIO=${STUB_SCENARIO:-success}
# Where the `slow` scenario's grandchild writes its heartbeat, so the harness can
# prove a process-group kill actually reaps grandchildren.
HEARTBEAT=${STUB_HEARTBEAT:-/tmp/omarchy-touchbar-stub-heartbeat}

json_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

phase() { printf '{"type":"phase","name":"%s","status":"%s"}\n' "$1" "$2"; }
info()  { printf '{"type":"log","phase":"%s","level":"info","text":"%s"}\n'  "$LOG_PHASE" "$(json_escape "$*")"; }
warn()  { printf '{"type":"log","phase":"%s","level":"warn","text":"%s"}\n'  "$LOG_PHASE" "$(json_escape "$*")"; }
fail()  { printf '{"type":"error","phase":"%s","message":"%s"}\n' "$LOG_PHASE" "$(json_escape "$1")"; exit 1; }

# Mirrors install.sh:148's on_error_trap, which reports the failing shell line
# rather than a sentence the user can act on.
raw_fail() {
  printf '{"type":"error","phase":"%s","message":"line %s: %s"}\n' "$LOG_PHASE" "$1" "$(json_escape "$2")"
  exit 1
}

# Mirrors install.sh:106-111 gui_ask. Must be called BARE, never in command
# substitution: $(...) would capture the question into a variable instead of the
# real stdout the GUI reads, hanging the GUI forever waiting for a question it
# never saw. install.sh:104 carries a comment saying exactly that.
GUI_ANSWER=""
ask() {
  printf '{"type":"question","kind":"%s"}\n' "$1"
  local line=""
  IFS= read -r line || fail "no answer received from the GUI"
  GUI_ANSWER=$(printf '%s' "$line" | sed -n 's/.*"answer"[ ]*:[ ]*"\([^"]*\)".*/\1/p')
}

analysis() {
  phase analysis start
  LOG_PHASE=analysis
  info "Detecting distribution and session"
  info "Build dependencies: libdrm libcairo pango librsvg"
  phase analysis done
}

deploy() {
  phase deploy start
  LOG_PHASE=deploy
  info "Resolving packages (only what is missing)"
  # npm and node-gyp write plenty of stderr on a clean build. In GUI mode the
  # real script never writes to stderr itself, so this is pure tool noise and
  # the wizard must render it as neutral info, not as a wall of warnings.
  echo "npm warn deprecated node-gyp@10.0.0: Python 2 is no longer supported" >&2
  echo "gyp info using node@20.19.0" >&2
  info "Building native addon"
  phase deploy done
}

case "$SCENARIO" in
  success)
    analysis
    if [[ ${STUB_ASK:-0} == 1 ]]; then
      phase purge start
      LOG_PHASE=purge
      ask purge
      if [[ $GUI_ANSWER != PURGE ]]; then fail "installation cancelled before purge"; fi
      info "Purged tiny-dfr"
      phase purge done
    fi
    deploy
    LOG_PHASE=deploy
    printf '{"type":"done","needsRelogin":%s}\n' "${STUB_NEEDS_RELOGIN:-false}"
    ;;

  fail-message)
    # The curated-failure path: install.sh:365, a real sentence.
    analysis
    LOG_PHASE=analysis
    fail "Touch Bar hardware (05ac:8302) not found"
    ;;

  fail-raw)
    # The ERR-trap path: the user gets a shell command, not an explanation.
    analysis
    LOG_PHASE=deploy
    phase deploy start
    raw_fail 890 '(cd "$REPO_ROOT/linux-touchbar-control-center" && npm run build)'
    ;;

  exit-2)
    analysis
    LOG_PHASE=analysis
    warn "NixOS is not handled by this installer. Follow the manual setup instructions."
    exit 2
    ;;

  huge-line)
    # One pathological line. The wizard truncates; without that this is a single
    # enormous DOM node with white-space: pre-wrap.
    analysis
    LOG_PHASE=deploy
    printf 'compiler said: '
    head -c 1048576 /dev/zero | tr '\0' 'x'
    printf '\n'
    ;;

  flood)
    analysis
    LOG_PHASE=deploy
    # More lines than the log's ring buffer holds, so the cap and the
    # "earlier output dropped" marker are both exercised.
    for i in $(seq 1 10000); do printf 'build log line %s\n' "$i"; done
    ;;

  slow)
    # Long-running, and it forks a grandchild the way npm ci / pacman do, so the
    # harness can prove a process-group kill reaches past the shell.
    analysis
    phase deploy start
    LOG_PHASE=deploy
    ( while true; do printf 'tick %s\n' "$(date +%s)" >> "$HEARTBEAT"; sleep 0.2; done ) &
    # Recorded so the harness can reap it by exact pid. pkill -f would match
    # the harness's own command line and kill the wrong thing.
    printf '%s\n' "$!" > "$HEARTBEAT.pid"
    info "Pretending to build for a long time"
    for _ in $(seq 1 600); do sleep 0.2; done
    phase deploy done
    printf '{"type":"done","needsRelogin":false}\n'
    ;;

  *)
    echo "unknown STUB_SCENARIO: $SCENARIO" >&2
    exit 64
    ;;
esac

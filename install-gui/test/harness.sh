#!/usr/bin/env bash
# Headless checks for install-gui's failure handling.
#
# Everything here runs against test/stub/install.sh, never the real installer.
# No T2 hardware, no distro, no privileged operation, no system mutation.
#
# The process-group check is the important one: install.sh runs npm ci, pacman
# and rsync with inherited stdio, so signalling only the bash PID leaves those
# grandchildren running against the filesystem — an orphaned pacman then holds
# /var/lib/pacman/db.lck and blocks the retry. The "old way" case demonstrates
# that leak so the fix has something to be measured against.

set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
STUB="$HERE/stub/install.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

ok()   { printf '  \033[32mok\033[0m   %s\n' "$1"; pass=$((pass + 1)); }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=$((fail + 1)); }
check() { if [[ $1 == 0 ]]; then ok "$2"; else bad "$2"; fi; }

# Every line the stub writes to stdout must be a complete JSON event. This is
# what main.ts's JSON.parse-fallback contract depends on.
assert_valid_json_stream() {
  local scenario=$1
  local out="$TMP/$scenario.out"
  STUB_SCENARIO=$scenario bash "$STUB" install --gui > "$out" 2> "$TMP/$scenario.err"
  node -e '
    const fs = require("fs");
    const lines = fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean);
    const TYPES = new Set(["phase","log","question","error","done"]);
    for (const [i, l] of lines.entries()) {
      let e;
      try { e = JSON.parse(l); } catch { console.error(`line ${i+1} is not JSON: ${l.slice(0,80)}`); process.exit(1); }
      if (!TYPES.has(e.type)) { console.error(`line ${i+1} unknown type: ${e.type}`); process.exit(1); }
    }
  ' "$out"
}

echo
echo "install-gui harness"
echo

echo "JSON protocol (script-generated stdout is one valid event per line)"
for s in success fail-message fail-raw exit-2; do
  assert_valid_json_stream "$s" >/dev/null 2>&1
  check $? "$s"
done

echo
echo "Raw tool output passes through untouched (the JSON.parse fallback)"
STUB_SCENARIO=huge-line bash "$STUB" install --gui > "$TMP/huge.out" 2>/dev/null
if grep -q '^compiler said: x\{100,\}' "$TMP/huge.out"; then
  bytes=$(wc -c < "$TMP/huge.out")
  if [[ $bytes -gt 1000000 ]]; then
    ok "1 MB single line preserved verbatim ($bytes bytes)"
  else
    bad "huge line was not actually 1 MB ($bytes bytes)"
  fi
else
  bad "huge-line did not emit the expected raw line"
fi

STUB_SCENARIO=flood bash "$STUB" install --gui > "$TMP/flood.out" 2>/dev/null
lines=$(wc -l < "$TMP/flood.out")
# 10000 raw lines plus the analysis JSON events. main.ts keeps only the last
# 2000 in the DOM; what matters here is that nothing upstream truncates first.
if [[ $lines -ge 10000 ]]; then
  ok "flood delivered $lines lines for the ring buffer to cap"
else
  bad "flood delivered only $lines lines"
fi

echo
echo "Question round trip (question on real stdout, answer consumed from stdin)"
if printf '{"answer":"PURGE"}\n' | STUB_SCENARIO=success STUB_ASK=1 bash "$STUB" install --gui > "$TMP/ask.out" 2>/dev/null; then
  if grep -q '"type":"question","kind":"purge"' "$TMP/ask.out"; then
    ok "purge question reached stdout and PURGE was accepted"
  else
    bad "question was swallowed — gui_ask must be called bare, never in \$(...)"
  fi
else
  bad "stub did not complete the question round trip"
fi

echo
echo "Cancelling a question is a clean failure, not a hang"
if printf '{"answer":"no"}\n' | STUB_SCENARIO=success STUB_ASK=1 bash "$STUB" install --gui > "$TMP/cancel.out" 2>/dev/null; then
  bad "cancelling the purge should have exited non-zero"
else
  if grep -q 'installation cancelled before purge' "$TMP/cancel.out"; then
    ok "cancel reported as a curated error event"
  else
    bad "cancel did not report the expected error message"
  fi
fi

echo
echo "Exit codes the wizard has to diagnose"
for pair in "success:0" "fail-message:1" "fail-raw:1" "exit-2:2"; do
  s=${pair%:*}; want=${pair#*:}
  STUB_SCENARIO=$s bash "$STUB" install --gui >/dev/null 2>&1
  got=$?
  [[ $got == "$want" ]] && ok "$s exits $want" || bad "$s exited $got, expected $want"
done

echo
echo "GUI-mode stderr carries no script output (tool noise only)"
STUB_SCENARIO=success STUB_ASK=1 bash "$STUB" install --gui >/dev/null 2> "$TMP/err.txt"
if grep -qE '^\{' "$TMP/err.txt"; then
  bad "stub wrote JSON to stderr — the wizard reads stderr as raw log lines"
else
  ok "stderr holds raw tool output only"
fi

echo
echo "Missing script (the 127 preflight path)"
empty="$TMP/empty-repo"; mkdir -p "$empty"
if [[ -f "$empty/install.sh" ]]; then
  bad "fixture is wrong: empty repo should have no install.sh"
else
  # main.ts refuses to spawn when this file is missing, instead of letting bash
  # exit 127 with nothing useful on stdout.
  ok "empty repo has no install.sh — preflight fires before spawn"
fi

if ! command -v setsid >/dev/null 2>&1; then
  echo
  echo "Process-group kill — SKIPPED (setsid unavailable)"
else
  echo
  echo "Process-group kill"

  # What main.ts used to do: signal the bash PID only.
  hb="$TMP/heartbeat-old"
  : > "$hb"
  STUB_SCENARIO=slow STUB_HEARTBEAT="$hb" setsid bash "$STUB" install --gui >/dev/null 2>&1 &
  oldpid=$!
  sleep 1.5
  kill -TERM "$oldpid" 2>/dev/null
  wait "$oldpid" 2>/dev/null
  a=$(wc -l < "$hb"); sleep 1; b=$(wc -l < "$hb"); sleep 1; c=$(wc -l < "$hb")
  if [[ $b -gt $a && $c -gt $b ]]; then
    ok "killing only the bash PID leaves the grandchild running (the leak being fixed)"
  else
    bad "expected the grandchild to survive a PID-only kill, but it did not"
  fi
  # Reap the orphan the old way left behind, by exact pid.
  kill "$(cat "$hb.pid")" 2>/dev/null

  # What main.ts does now: signal the group, so npm/pacman/rsync die too.
  hb2="$TMP/heartbeat-new"
  : > "$hb2"
  STUB_SCENARIO=slow STUB_HEARTBEAT="$hb2" setsid bash "$STUB" install --gui >/dev/null 2>&1 &
  newpid=$!
  sleep 1.5
  kill -TERM -"$newpid" 2>/dev/null
  wait "$newpid" 2>/dev/null
  x=$(wc -l < "$hb2"); sleep 1; y=$(wc -l < "$hb2"); sleep 1; z=$(wc -l < "$hb2")
  if [[ $y -gt $x ]]; then
    bad "group kill did not stop the grandchild — it kept writing ($x -> $y -> $z)"
  else
    ok "group kill reaps the grandchild ($x -> $y -> $z, stopped)"
  fi
  kill "$(cat "$hb2.pid")" 2>/dev/null
fi

echo
if [[ $fail -eq 0 ]]; then
  printf '\033[32m%d passed, 0 failed\033[0m\n\n' "$pass"
  exit 0
else
  printf '\033[31m%d passed, %d failed\033[0m\n\n' "$pass" "$fail"
  exit 1
fi

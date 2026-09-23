#!/usr/bin/env bash
#
# Omarchy entry point for the Omarchy Touch Bar uninstaller.
#
# Mirrors install-omarchy.sh: on Omarchy the daemon is deployed to
# ~/.local/share/omarchy-touchbar by install.sh and removed by uninstall.sh.
# This wrapper is what the README's uninstall section invokes.

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

if [[ ! -e /usr/share/libalpm/hooks/00-omarchy-update-guard.hook ]]; then
  printf 'uninstall-omarchy.sh is for Omarchy; on other distributions use uninstall.sh directly.\n' >&2
  exit 2
fi

exec "$SCRIPT_DIR/uninstall.sh" uninstall
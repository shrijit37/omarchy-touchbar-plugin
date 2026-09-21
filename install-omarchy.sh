#!/usr/bin/env bash
#
# Omarchy entry point for the react-drm Touch Bar installer.
#
# Omarchy routes system upgrades through `omarchy update` and blocks direct
# `pacman -Syu` with an ALPM pre-transaction hook (00-omarchy-update-guard,
# AbortOnFail). install.sh's Arch branch installs dependencies with plain
# `pacman -S --needed`, which the guard ignores — this installer never
# triggers a system upgrade.
#
# If the dependency transaction fails to resolve because the system is stale,
# run `omarchy update` first, then re-run this script.

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

if [[ ! -e /usr/share/libalpm/hooks/00-omarchy-update-guard.hook ]]; then
  printf 'install-omarchy.sh is for Omarchy; on other distributions use install.sh directly.\n' >&2
  exit 2
fi

exec "$SCRIPT_DIR/install.sh" install
#!/usr/bin/env bash
# The Rust half of "verified" for this app. The Lefthook pre-push runs it when a push
# touches the Rust core or the i18n catalogs the tray embeds; the release gate and the
# on-demand CI run it on Linux. One script, so the three can never drift.
#
# Measured 2026-09-26 on the owner's machine: ~7 s with a warm target/.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR/src-tauri"

cargo fmt --check
cargo clippy --all-targets -- -D warnings
# The suite includes `export_bindings`, which rewrites ../src/bindings.ts.
cargo test

cd "$APP_DIR"
if ! git diff --quiet -- src/bindings.ts; then
  git --no-pager diff --stat -- src/bindings.ts
  echo "verify-rust: src/bindings.ts is stale — the Rust commands changed. It has been" >&2
  echo "regenerated in your working tree; review and commit it." >&2
  exit 1
fi

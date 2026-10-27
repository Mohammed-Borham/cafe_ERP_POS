#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pnpm exec vite build

SOURCE_DIR="$ROOT_DIR/dist/public"
TARGET_DIR="$ROOT_DIR/public"
if [[ ! -f "$SOURCE_DIR/index.html" ]]; then
  echo "Expected Vite output at $SOURCE_DIR/index.html" >&2
  exit 1
fi

# Replace only the generated public directory; never copy dist/backend bundles.
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cp -a "$SOURCE_DIR/." "$TARGET_DIR/"

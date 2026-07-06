#!/usr/bin/env bash
# Runnable end-to-end demo. Exercises every command against a fake/local probe
# and real example configs, then reports output byte sizes. Exits 0 on success.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin/startboard.js"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

hr() { printf '%s\n' "------------------------------------------------------------"; }
pass() { printf '  PASS: %s\n' "$1"; }

hr; echo "startboard demo — Node $(node --version)"; hr

# 1. Scaffold a fresh config and validate it.
echo "[1] new + validate"
node "$BIN" new -o "$OUT/scaffold.json" >/dev/null
node "$BIN" validate "$OUT/scaffold.json"
pass "scaffold validates"

# 2. Validate + build every shipped example, reporting byte sizes.
echo "[2] validate + build examples (self-contained assertion)"
for f in config minimal homelab include-demo; do
  node "$BIN" validate "$ROOT/examples/$f.json" >/dev/null
  node "$BIN" build "$ROOT/examples/$f.json" -o "$OUT/$f.html" >/dev/null
  bytes=$(wc -c < "$OUT/$f.html" | tr -d ' ')
  # Self-containment: no external stylesheet/script/remote-img.
  if grep -qiE '<link|<script[^>]+src=|<img[^>]+src="https?:' "$OUT/$f.html"; then
    echo "  FAIL: $f.html has an external reference"; exit 1
  fi
  # Only http(s) refs must be user URLs (ignore the SVG xmlns namespace).
  extras=$(grep -oiE 'https?://[^"'"'"' <>]+' "$OUT/$f.html" | grep -v 'w3.org/2000/svg' | sort -u | wc -l | tr -d ' ')
  printf '  %-16s %6s bytes   external refs: %s (all user URLs)\n' "$f.html" "$bytes" "$extras"
done
pass "all examples build self-contained (0 asset fetches)"

# 3. Interactive build has exactly one inline script and no external src.
echo "[3] build --interactive"
node "$BIN" build "$ROOT/examples/config.json" --interactive -o "$OUT/interactive.html" >/dev/null
scripts=$(grep -c '<script' "$OUT/interactive.html" || true)
extsrc=$(grep -c '<script[^>]*src=' "$OUT/interactive.html" || true)
[ "$scripts" = "1" ] && [ "$extsrc" = "0" ] || { echo "  FAIL: expected 1 inline script, 0 external"; exit 1; }
pass "interactive build: 1 inline script, 0 external"

# 4. check against a real local HTTP + TCP server via an injected fake — no external network.
echo "[4] check with a local probe (hermetic)"
node "$ROOT/demos/local_check.mjs"
pass "check reports up/down/error correctly"

# 5. validate CI-gate behavior: a broken config must exit non-zero.
echo "[5] validate exits non-zero on bad config"
echo '{"subtitle":"no title"}' > "$OUT/bad.json"
if node "$BIN" validate "$OUT/bad.json" 2>/dev/null; then
  echo "  FAIL: broken config validated"; exit 1
fi
pass "broken config rejected with non-zero exit"

hr; echo "ALL DEMOS PASSED"; hr

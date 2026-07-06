#!/usr/bin/env sh
# Install the `startboard` CLI on macOS/Linux.
# Prefers `npm link`; falls back to a shim in ~/.local/bin.
set -eu

ROOT="$(cd "$(dirname "$0")" && pwd)"
BIN="$ROOT/bin/startboard.js"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required (v20+)." >&2
  exit 1
fi

if command -v npm >/dev/null 2>&1; then
  echo "Linking via npm..."
  ( cd "$ROOT" && npm link ) && {
    echo "Installed. Try: startboard help"
    exit 0
  }
  echo "npm link failed; falling back to a shim." >&2
fi

TARGET="${PREFIX:-$HOME/.local}/bin"
mkdir -p "$TARGET"
SHIM="$TARGET/startboard"
cat > "$SHIM" <<EOF
#!/usr/bin/env sh
exec node "$BIN" "\$@"
EOF
chmod +x "$SHIM"
echo "Installed shim at $SHIM"
case ":$PATH:" in
  *":$TARGET:"*) : ;;
  *) echo "note: add $TARGET to your PATH." ;;
esac
echo "Try: startboard help"

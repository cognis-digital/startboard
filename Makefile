# startboard — dev tasks. Zero runtime deps; these targets only need Node + sh.

NODE ?= node
BIN  := bin/startboard.js

.PHONY: help test demo lint typecheck install clean examples

help:
	@echo "targets: test demo lint typecheck install examples clean"

test:
	$(NODE) --test "test/*.test.js"

demo:
	sh demos/run_all.sh

# "lint" = the CI gate: the shipped example must validate.
lint:
	$(NODE) $(BIN) validate examples/config.json

# Optional type checking via tsc --checkJs (no install if tsc is absent).
typecheck:
	@if command -v tsc >/dev/null 2>&1; then \
	  tsc --checkJs --allowJs --noEmit --module esnext --target es2022 \
	    --moduleResolution node src/*.js bin/*.js; \
	else \
	  echo "tsc not found; skipping (install typescript to enable)"; \
	fi

# Rebuild every example board into ./dist for inspection.
examples:
	@mkdir -p dist
	@for f in config minimal homelab include-demo; do \
	  $(NODE) $(BIN) build examples/$$f.json -o dist/$$f.html; \
	done

install:
	sh install.sh

clean:
	rm -rf dist *.tmp board.html

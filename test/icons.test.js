import { test } from "node:test";
import assert from "node:assert/strict";
import { renderIcon, builtinIconNames, isSafeInlineSvg } from "../src/icons.js";

test("empty / non-string icon yields empty string", () => {
  assert.equal(renderIcon(""), "");
  assert.equal(renderIcon(undefined), "");
  assert.equal(renderIcon(42), "");
});

test("emoji renders as escaped text span", () => {
  const html = renderIcon("📈");
  assert.ok(html.includes("icon-emoji"));
  assert.ok(html.includes("📈"));
  assert.ok(html.includes('aria-hidden="true"'));
});

test("built-in glyph renders as inline svg data URI (no network)", () => {
  for (const name of builtinIconNames()) {
    const html = renderIcon(`glyph:${name}`);
    assert.ok(html.includes("data:image/svg+xml,"), `${name} data uri`);
    assert.equal(/https?:\/\/(?!www\.w3\.org)/.test(html), false, "no remote refs");
  }
});

test("bare known glyph name works without prefix", () => {
  assert.ok(renderIcon("chart").includes("data:image/svg+xml,"));
});

test("raw inline svg is embedded when safe", () => {
  const html = renderIcon('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>');
  assert.ok(html.includes("data:image/svg+xml,"));
});

test("unsafe inline svg (script / remote / onload) is rejected", () => {
  assert.equal(isSafeInlineSvg('<svg><script>x</script></svg>'), false);
  assert.equal(isSafeInlineSvg('<svg onload="x()"></svg>'), false);
  assert.equal(isSafeInlineSvg('<svg><image href="https://x/y.png"/></svg>'), false);
  assert.equal(isSafeInlineSvg('<svg><foreignObject></foreignObject></svg>'), false);
  assert.equal(isSafeInlineSvg('<svg viewBox="0 0 1 1"><rect/></svg>'), true);
});

test("unsafe raw svg icon renders empty (fails closed)", () => {
  assert.equal(renderIcon('<svg onload="alert(1)"></svg>'), "");
});

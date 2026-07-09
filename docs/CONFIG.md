# Config reference

A startboard config is a JSON object. The only required field is `title`. The
machine-readable schema lives at [`docs/startboard.schema.json`](startboard.schema.json)
(JSON Schema draft-07); point your editor at it for autocomplete. The hand-rolled
validator in `src/validate.js` enforces the same rules with zero dependencies.

## Top level

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | ✅ | Non-empty. Document title + heading. |
| `subtitle` | string | | Shown under the title. |
| `theme` | string | | `slate` (default), `terminal`, `amber`, `ocean`, or legacy `light`/`dark`. |
| `css` | string | | Extra inline CSS. Rejected if it uses `@import`, `url(http/data)`, `expression()`, or embedded tags. |
| `include` | string[] | | Relative paths to other configs, merged before this file. |
| `groups` | Group[] | | Bookmark groups. |
| `notes` | Note[] | | Markdown-ish note panels. |
| `status` | Status[] | | Service-status targets. |
| `boards` | Board[] | | Multiple boards → CSS-only tabbed layout. |

If `boards` is present, the top-level `groups`/`notes`/`status` render as the
page body *and* each board renders as a tab — so you typically use one or the
other. A common pattern is `boards` only.

## Group

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | ✅ | Non-empty. |
| `links` | Link[] | ✅ | May be empty. |
| `icon` | string | | Emoji (`"📈"`), built-in glyph (`"glyph:chart"`), or inline `<svg>`. |
| `collapsed` | boolean | | Render collapsed (`<details>` without `open`). |
| `order` | number | | Sort key (ascending; stable on ties). |

Built-in glyph names: `link`, `chart`, `book`, `server`, `shield`, `globe`,
`folder`, `search`, `terminal`.

## Link

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `label` | string | ✅ | Non-empty. |
| `url` | string | ✅ | Must be `http`/`https`. `javascript:`, `data:`, `file:` are rejected. |
| `description` | string | | Secondary line. |
| `icon` | string | | Same forms as group `icon`. |
| `order` | number | | Sort key. |

## Note

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | ✅ | Non-empty. |
| `body` | string | ✅ | Rendered as markdown-ish by default. |
| `markdown` | boolean | | Set `false` for plain preformatted text. |
| `order` | number | | Sort key. |

Supported markdown: headings (`#`…), `**bold**`, `*italic*`, `` `code` ``,
fenced ``` ``` ``` code blocks, `- ` / `1. ` lists, `> ` blockquotes, `---`
rules, and `[label](https://url)` links (http/https only). Everything is
HTML-escaped first; raw HTML never passes through.

## Status target

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | ✅ | Non-empty. |
| `url` | string | ✅ | `http(s)://…` for `http`; `host:port` for `tcp`. |
| `type` | `"http"` \| `"tcp"` | | Default `http`. |
| `timeoutMs` | number | | Positive. Default 5000. |
| `okStatuses` | integer[] | | HTTP only. Overrides the default 2xx/3xx = up. |

Status is checked by `startboard check` (prints results) or embedded into the
page with `startboard build --check`. A static file cannot self-refresh, so the
build records a "Last checked" timestamp rather than a live history.

## Includes / merge

```jsonc
// team.json
{ "include": ["./common.json"], "title": "Team Board", "groups": [ /* … */ ] }
```

`common.json` is loaded first, then `team.json` is merged over it: arrays
concatenate (common's groups first), scalars take team's value. Paths are
relative to the including file. Cycles are rejected.

## Example

See [`examples/`](../examples): `config.json` (analyst/OSINT), `homelab.json`
(tabbed boards + TCP probes + custom CSS), `minimal.json`, and `include-demo.json`.

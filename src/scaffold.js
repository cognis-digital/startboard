// @ts-check
// Scaffold a starter config for `startboard new`.

/**
 * Return a fresh starter config object. Exercises the common features (icons,
 * a collapsible group, a markdown note, a status target) while staying valid
 * and buildable.
 * @returns {import("./validate.js").Config}
 */
export function scaffoldConfig() {
  return {
    title: "My Start Board",
    subtitle: "A self-hosted dashboard for daily links, notes, and status.",
    theme: "slate",
    groups: [
      {
        title: "Daily",
        icon: "📌",
        links: [
          { label: "Calendar", url: "https://calendar.example.com", description: "Today's schedule" },
          { label: "Mail", url: "https://mail.example.com" },
        ],
      },
      {
        title: "Research",
        icon: "glyph:book",
        collapsed: true,
        links: [
          { label: "Wikipedia", url: "https://www.wikipedia.org", description: "Reference" },
        ],
      },
    ],
    notes: [
      {
        title: "Scratchpad",
        body: "Keep short-lived notes here.\n\n- **Bold** and *italic* work\n- `code` too\n- [links](https://example.com) are validated\n\nEdit the config and rebuild.",
      },
    ],
    status: [
      { name: "Example", url: "https://example.com", timeoutMs: 5000, okStatuses: [200] },
    ],
  };
}

/**
 * Serialize the starter config as pretty JSON with a trailing newline.
 * @returns {string}
 */
export function scaffoldConfigJson() {
  return JSON.stringify(scaffoldConfig(), null, 2) + "\n";
}

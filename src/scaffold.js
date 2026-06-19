// Scaffold a starter config for `startboard new`.

/**
 * Return a fresh starter config object. Kept in sync with the example so
 * `new` always produces a config that validates and builds.
 * @returns {import("./validate.js").Config}
 */
export function scaffoldConfig() {
  return {
    title: "My Start Board",
    subtitle: "A self-hosted dashboard for daily links, notes, and status.",
    theme: "dark",
    groups: [
      {
        title: "Daily",
        links: [
          {
            label: "Calendar",
            url: "https://calendar.example.com",
            description: "Today's schedule",
          },
          {
            label: "Mail",
            url: "https://mail.example.com",
          },
        ],
      },
      {
        title: "Research",
        links: [
          {
            label: "Wikipedia",
            url: "https://www.wikipedia.org",
            description: "Reference",
          },
        ],
      },
    ],
    notes: [
      {
        title: "Scratchpad",
        body: "Keep short-lived notes here.\nEdit the config and rebuild.",
      },
    ],
    status: [
      {
        name: "Example",
        url: "https://example.com",
        timeoutMs: 5000,
        okStatuses: [200],
      },
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

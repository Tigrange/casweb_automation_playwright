# AGENTS.md

## Working preferences

- Before refactoring structure (renaming files/classes, reworking object patterns, etc.), save a plan first and confirm it.
- Only deviate from an existing structure/pattern when the change is genuinely necessary; keep consistency with surrounding code (e.g. page/popup classes in `src/pages/` should follow the established `BasePage` / constructor idiom).
- Partner-specific page objects: when a partner's DOM differs, create a dedicated `<Partner><Feature>Page.js` that `extends` the shared base page class and overrides only the differing selectors/methods; register it in the feature's factory/registry (e.g. `src/factories/*Registry.js`).
- Selectors: use stable test hooks only — element ids, data attributes (`[data-href]`, `[data-message-id]`, ...), and JS behaviour classes whose name contains `js` (e.g. `.js_msg_item`, `.js_delete_msg`). Do NOT use styling classes (`primary-btn`, `primary-btn--bordered`, `inbox-popup`, `inbox_v2`, ...) for tests.
- Git safety: NEVER commit or push without asking the user first and getting an explicit "yes". Workflow: implement (files only) → show summary/diff → ask "commit and push?" → only then commit/push.
- TestRail: per-device case IDs are attached at runtime from each project's `metadata.authDevice` (`tests/support/testrail.js`); publish with `node scripts/publish-testrail.mjs <results.json>` (runners write `results-<partner>-<unit>.json` + a `.artifacts` sidecar).

## Production checklist (players / passwords)

Before running the suites against production, verify:

1. Every DEVICE has its OWN player account — never share one account between the `desktop` and `mobile` player JSONs.
2. `.env` accounts are DIFFERENT from the `tests/support/players/*.json` automation players.
3. Passwords are auto-generated per change (`change_password.spec.js`); never reuse a previously used password manually — the platform rejects it.
4. A password change must be mirrored into every player file that uses the same username (the spec syncs the twin device file automatically; keep that behaviour if refactoring).
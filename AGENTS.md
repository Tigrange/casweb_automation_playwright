# AGENTS.md

## Working preferences

- Before refactoring structure (renaming files/classes, reworking object patterns, etc.), save a plan first and confirm it.
- Only deviate from an existing structure/pattern when the change is genuinely necessary; keep consistency with surrounding code (e.g. page/popup classes in `src/pages/` should follow the established `BasePage` / constructor idiom).
- Partner-specific page objects: when a partner's DOM differs, create a dedicated `<Partner><Feature>Page.js` that `extends` the shared base page class and overrides only the differing selectors/methods; register it in the feature's factory/registry (e.g. `src/factories/*Registry.js`).
- Selectors: use stable test hooks only — element ids, data attributes (`[data-href]`, `[data-message-id]`, ...), and JS behaviour classes whose name contains `js` (e.g. `.js_msg_item`, `.js_delete_msg`). Do NOT use styling classes (`primary-btn`, `primary-btn--bordered`, `inbox-popup`, `inbox_v2`, ...) for tests.
# Progress — Cazweb Playwright Automation (Session Notes)

Status: **Paused by user.** Resume points below (server-render Diligencia/TotoGaming app).

## Working / Verified
- **Login flow (device-aware `LoginPopup`)** — passing end-to-end on **prod** (totogaming.am) and **test** (totogaming.tst-digi.com).
  - Prod creds in `.env` updated and now validate. Login suite: `setup [test]`, `setup [prod]`, valid login, invalid login = all green.
  - Desktop template must be selected (site serves different HTML on mobile). `setup` project forced to `devices['Desktop Chrome']`.
- **Architecture**: multi-env (`test|prod`), multi-partner registry, device-aware `BasePage` (`sel()` maps desktop/mobile), `storageState` auth capture, custom `automation` attribute + `sel`/`locator` helpers.

## Placeholders / Needs verification
- **RegisterPopup** (`src/pages/auth/RegisterPopup.js`): device-aware `sel()` done; desktop selectors confirmed by id (`#UserName`, `#Email`, `#Password`, `#PasswordValidation`, `#Mobile`, `#MobileCode`, submit `#js_reg_btn_submit`, back `#js_reg_btn_back`). BUT:
  - Registration is a **multi-step** form — only first step + "Continue" implemented. DOB, documents, GDPR, mobile confirmation still to map.
  - Form fields have **no `automation` attributes** yet — ask devs to add them.
- **ChangePasswordPopup** (`src/pages/auth/ChangePasswordPopup.js`): device-aware structure done but selectors are **placeholders** — must be captured against the real logged-in user menu.
- **Mobile**: mobile projects defined in `playwright.config.js` but **disabled** (default = desktop). Mobile selectors in login/register are best-guess; verify when enabling.
- **Casino / Betting / Inbox pages**: still placeholder `automation` keys; not yet device-aware. Selectors must come from real DOM.
- **`tests/support/setup.spec.js`** loops every partner × env; `getRuntimeConfig` reads creds from `.env` (gitignored).

## Env notes (this machine)
- A leftover Playwright `test-server` node process sometimes locks `test-results` → kill node processes matching 'playwright' and delete `test-results` before a run.
- `page.viewportSize()` is synchronous here (used for device detection).
- Temp diagnostics (`debug.mjs`, `probe-*.mjs`) were removed.

## Suggested next steps (in order)
1. Add `automation` attributes to register fields (devs) + map full multi-step registration → write `auth/register.spec.js`.
2. Capture real `ChangePasswordPopup` selectors from logged-in user menu → `auth/change-password.spec.js`.
3. Build casino (slot / fast-game / skill-game) page objects + spec.
4. Betting (sport / casino) per-partner.
5. Inbox message create/view.
6. Enable mobile projects + fill mobile selector maps; add CI mobile stage.
7. Convert remaining page objects (casino/betting/inbox) to device-aware `sel()` maps.
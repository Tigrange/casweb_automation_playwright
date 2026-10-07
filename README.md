# Cazweb Automation

End-to-end Playwright framework for the Cazweb partner sites (TotoGaming,
Totoro, Cozbet Shared, Betfa). It runs the same suites against multiple
partners and environments, on desktop and mobile browsers, and merges every run
into one HTML report per feature.

The framework is built so a tester mainly works in `tests/`, `src/pages/` and
`tests/data/`. Authentication, artifacts, partner configuration and orchestration
are handled for you.

## 1. Introduction

- **Multi-partner / multi-environment** — partners are declared in
  `src/config/partners.js`; each declares its environments (`test`, `prod`) and
  feature flags. Credentials come from `.env`.
- **Real login once, verify everywhere** — a real login is performed only by the
  dedicated auth projects (`auth-desktop`, `auth-mobile`). Browser projects reuse
  the saved session and only verify the logged-in UI.
- **Feature isolation** — every feature writes its own artifact tree
  (`artifacts/<feature>/{blob,test-results,report}`), so Login and Register never
  touch each other.
- **Tagged tests** — tests carry plain-string tags (`@positive`, `@negative`,
  `@smoke`, `@regression`). The default run is positive-only.

## 2. How It Works

### Runners

There are two feature runners plus a top-level orchestrator:

- `scripts/run-register-all-partners.js` — registration only. **No auth, no
  login, no storageState.**
- `scripts/run-login-all-partners.js` — login only, in two sequential phases per
  partner: desktop (one real login → Chromium/Firefox/WebKit) then mobile (one
  real login → mobile Chromium).
- `scripts/run-all.js` — runs Register, then Login.

```mermaid
flowchart TD
    A[run-all.js] --> B[REGISTER runner]
    B -->|pass| C[LOGIN runner]
    B -->|fail| D[stop, exit non-zero]
    C --> E[desktop phase: auth-desktop + chromium/firefox/webkit]
    E --> F[mobile phase: auth-mobile + mobile-chromium]
```

### Login authentication flow

A partner account allows only one active session, so desktop and mobile auth must
never overlap for the same partner. That is why each partner's phases run
sequentially, while different partners run concurrently.

```mermaid
sequenceDiagram
    participant R as Login runner
    participant A as auth-desktop
    participant B as e2e browsers
    participant M as auth-mobile
    participant MC as mobile chromium
    R->>A: 1 real desktop login
    A-->>R: <env>-<partner>-desktop.json
    R->>B: chromium/firefox/webkit
    B-->>R: verify session (no login)
    R->>M: 1 real mobile login
    M-->>R: <env>-<partner>-mobile.json
    R->>MC: mobile chromium
    MC-->>R: verify session (no login)
```

### Artifacts and combined report

Each runner spawns Playwright with the `blob` reporter into its own feature
folder, then `playwright merge-reports` builds one self-contained HTML report for
that feature. Register and Login reports are separate.

## 3. Technical Documentation

### Project structure

```
src/
  config/       partners.js, env.js, index.js, storageState.js, testFilters.js
  pages/        BasePage + auth/LoginPopup, RegisterPopup, Betfa* popups
  factories/    loginRegistry.js, registerRegistry.js (partner -> popup class)
  fixtures/     base.js (test + runtime/api fixtures)
  utils/        automation.js, device.js, helpers.js
tests/
  auth/         login.spec.js, register.spec.js
  support/      authSetup.js, setup.desktop.spec.js, setup.mobile.spec.js
  data/         registerData.js
scripts/
  run-all.js, run-login-all-partners.js, run-register-all-partners.js
  lib/          runAllPartners.js (engine), artifacts.js (feature paths)
playwright.config.js
```

### Playwright projects

| Project | Purpose | Auth |
|---|---|---|
| `auth-desktop` | Real desktop login → `<env>-<partner>-desktop.json` | yes |
| `auth-mobile` | Real mobile login → `<env>-<partner>-mobile.json` | yes |
| `e2e-chromium` / `e2e-firefox` / `e2e-webkit` | Login session checks (reuse desktop state) | reuse |
| `e2e-mobile-chromium` | Login session check (reuse mobile state) | reuse |
| `register-chromium` / `register-mobile-chromium` | Registration, logged out | none |

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `PARTNER` | target partner id | `totogaming` |
| `PLAYWRIGHT_ENV` | `test` \| `prod` | `prod` (only `prod` is configured; an unconfigured env fails instead of falling back) |
| `TEST_TYPE` | `positive` \| `negative` \| `all` | `positive` |
| `TEST_TAG` | `smoke` \| `regression` | – |
| `PW_VIDEO` | `on` to keep videos of failed tests | off |
| `PW_FEATURE` | scope artifacts of **direct** `playwright test` runs | – |
| `PW_ARTIFACTS_DIR` | move the whole artifact root (e.g. off OneDrive) | `./artifacts` |
| `<PREFIX>_<ENV>_USERNAME` / `_PASSWORD` | partner credentials (see `.env.example`) | – |

### Setup

```bash
npm install
npx playwright install        # browsers
cp .env.example .env          # then fill credentials
```

### Running tests

Use the npm scripts. They already include the settings that work on this machine
(`--workers=2`, and `--parallel=2` for multi-partner runs).

```bash
# One partner (login and/or register). Available per-partner scripts:
#   test:login:<partner>  and  test:register:<partner>
#   partners: totogaming, totoro, cozbet_shared, betfa
npm run test:login:totogaming
npm run test:register:totogaming

# All working partners (currently totogaming + totoro), login then register
npm run test:login:all
npm run test:register:all

# Full suite: REGISTER then LOGIN (fail-fast)
npm run test:suite

# Include negative tests (LOGIN [02])
npm run test:login:all:full

# Direct Playwright (feature-scoped artifacts)
PW_FEATURE=login PARTNER=totogaming npx playwright test --project=e2e-chromium
```

Runner scripts can also be called directly. Login runner flags: `--env=`,
`--type=`, `--tag=`, `--parallel=<n>` (partner concurrency, default 2),
`--workers=<n>`, `--projects=`, and `-- <playwright args>` passthrough.

```bash
node scripts/run-login-all-partners.js totogaming totoro --parallel=2 --workers=2
node scripts/run-login-all-partners.js totogaming --type=all
node scripts/run-all.js totogaming totoro --parallel=2 --workers=2
```

> **Note (this machine):** the default worker count (about half the CPU threads)
> is too high for the available RAM when more than one partner runs in parallel.
> WebKit and Firefox then time out while starting. Always pass `--workers=2` for
> parallel partner runs; the npm scripts above already do. Use `--parallel=1` on
> a memory-constrained machine.

> `npm run test:report` opens the default Playwright report folder. Reports from
> the runners live under `artifacts/<feature>/report/` — open those with
> `npx playwright show-report artifacts/login/report` (or `register`).

### Adding a test

1. Add a spec under `tests/<feature>/`.
2. Add/extend a page object under `src/pages/`.
3. Put data under `tests/data/`.
4. Tag tests with `@positive` and/or `@negative` (and optionally `@smoke` /
   `@regression`). Import `test`/`expect` from `src/fixtures/base.js` when you
   need the `runtime`/`api` fixtures.

For a session-based test, declare the storage state per test, e.g.:

```js
test.use({ storageState: storageStatePath(envName, partnerId, 'desktop') });
```

### Adding a partner

1. Add an entry in `src/config/partners.js` (id, `displayName`, `envs` with
   `baseURL` + `credsEnvPrefix`, features).
2. Add credentials to `.env` using `<PREFIX>_<ENV>_USERNAME/_PASSWORD`.
3. If the login/register DOM differs, add a popup subclass under
   `src/pages/auth/` and register it in `src/factories/loginRegistry.js` or
   `registerRegistry.js`.
4. If registration data differs, add a builder in `tests/data/registerData.js`.

No runner changes are needed.

### Artifacts

```
artifacts/                      # or PW_ARTIFACTS_DIR
├── login/{blob,test-results,report}
└── register/{blob,test-results,report}
```

- `PW_FEATURE=<name>` makes direct `playwright test` runs use
  `artifacts/<name>/{test-results,report}`.
- `PW_ARTIFACTS_DIR=<path>` relocates the root (useful to keep large trees off
  OneDrive). Only generated artifacts move; source and tests stay in the repo.

### Firefox storageState and third-party origins

Firefox can intermittently fail to restore Playwright `storageState` when the saved state contains unnecessary third-party origins. In our environment, origins such as `fin-tg.com` / `fin-sh.com` were not required for authentication but could cause Firefox to fail while restoring the saved state.

To mitigate this, `tests/support/authSetup.js` persists only the partner's first-party origin (the runtime `baseURL` host and its subdomains) in `state.origins`. Cookies are preserved unchanged.

This has been verified across Chromium, Firefox, WebKit, and mobile Chromium, including multi-partner parallel login runs for TotoGaming and Totoro.

This mitigation addresses the specific third-party-origin storageState restore issue observed in the test environment.

### Known limitations

- A partner account allows one active session, so desktop and mobile auth for the
  same partner must not run concurrently; the runner already sequences them.
- Firefox storageState restore can still fail under heavy concurrent load for
  other reasons. The third-party-origin mitigation above addresses the specific
  problem observed here; it is not a guarantee against every Firefox
  storageState issue.
- On machines with low free RAM, parallel real logins can exceed timeouts; use
  `--workers=2` or `--parallel=1`.
- Two runners for the **same** feature at the same time (e.g. two Login runs for
  the same partner) still share the same storage-state file; run one at a time.
- On Windows a leftover Playwright `test-server` process can lock `test-results`
  and block a new run. `npm run test:clean:force_stop_all_processes` force-stops
  those processes and removes the generated report/artifact directories.
- Only Login and Registration are implemented so far; casino, betting and inbox
  page objects are not built yet.
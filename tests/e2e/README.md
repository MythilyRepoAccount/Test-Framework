# E2E framework (Playwright + TypeScript)

The setup steps and the defects found are in the [root README](../../README.md) and [NOTES.md](../../NOTES.md). This page covers how the framework is built.

## Layout

```
specs/          one file per feature; tests read as specifications
  login.spec.ts       5 tests: controls, admin login, claimant login, invalid credentials, empty form
  claims.spec.ts      happy path (4 places checked) + 2 known-defect tests
  claim-ownership.spec.ts  API only: 20 concurrent claims per user (D6) + a sequential control
pages/          page objects: locators and actions only, no test logic
  LoginPage.ts          waits for React hydration before interacting
  MyClaimsPage.ts       finds a row by claim ID; claimCells(); openClaimDetails()
  ClaimWizardPage.ts    3 steps; submit() returns the claim ID from the POST response
  ClaimDetailsModal.ts  field(label) reads a <dt>/<dd> value
fixtures/test.ts  extended `test`: page objects + `loggedInClaimant`
support/
  hooks.ts        afterEach body: failure screenshot
  tags.ts         tag constants (no magic strings in specs)
  bff-api.ts      BffApiSession: health check, API login, getClaim, logout
  claim-data.ts   buildValidClaim() (unique per run); list display rules
test-data/      users.json; claims.json (inputs + exact expected display strings)
Dockerfile      official Playwright image (pinned to 1.58.2, matching package.json)
docker-compose.yml  e2e-tests service: host network, reports mounted back to the host
```

## Run

```bash
npm install && npx playwright install chromium   # once
npm test                                         # all tests
npm run test:smoke | test:sanity | test:regression | test:login | test:claims
npm run test:headed                              # watch the browser
npm run report                                   # open the HTML report
npm run typecheck

docker compose run --rm e2e-tests                # same suite in a container (Podman: podman compose ...)
docker compose run --rm e2e-tests npm run test:smoke
```

## Hooks

| Hook | Where | Why |
|---|---|---|
| `beforeAll` / `afterAll` | `claim-ownership.spec.ts` | One API session per user (2 logins in total), logged out afterwards. Each submission runs in its own cookie jar, because the BFF rotates the CSRF cookie on every POST. |
| `beforeAll` | `claims.spec.ts` | Checks the BFF is up and fails fast with a clear message. Opens one API session as the claimant, separate from the browser, to prove the claim was saved on the server. Sharing it avoids an extra Keycloak login per test (rapid logins trip the lockout). |
| `afterAll` | `claims.spec.ts` | Logs that session out (ending its Keycloak session) and disposes it. Claims aren't deleted: there's no DELETE endpoint, and each claim's description is unique. |
| `beforeEach` | both specs | Login: opens a freshly loaded login page. Claims: logs in through the UI and opens the wizard. |
| `afterEach` | both specs | Attaches a full-page screenshot when a test fails, including the `test.fail()` defect tests, so the report holds evidence. The config's `screenshot` option is off to avoid duplicates. |

There's no `beforeAll`/`afterAll` in `login.spec.ts`. Each test has its own browser context, so there's nothing shared to set up or clean up.

## Tags

| Tag | Meaning | Tests |
|---|---|---|
| `@smoke` | Is the app up, and can each role get in? | Login controls, admin login, claimant login, claim happy path |
| `@sanity` | Do the core flows work? | Admin login, claimant login, invalid credentials, claim happy path |
| `@regression` | Everything, including edge cases and known defects | All 10 tests |
| `@login` | Authentication | All 5 login tests (set on the `Login` describe) |

## Conventions

- **Locators:** role and label first (`getByRole`, `getByLabel`), `data-testid` where the app provides one, and IDs only for form inputs whose accessible name is ambiguous.
- **No sleeps.** Waits are on observable state: the rendered list, the wizard heading, the React hydration marker, the network response.
- **Retries are targeted, not blanket.** The only `toPass` loop is `startNewClaim()`, and the comment says why (defect D5).
- **Expected values are literal strings**, never computed with the app's own formatters.

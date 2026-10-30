# Claims App: QA Assessment

Automated tests for the Chubb APAC insurance claims application, at three levels: **unit**, **component** and **end-to-end / integration**. The tests concentrate on the two journeys the business can't afford to lose: **logging in**, and **filing a claim and proving it was stored correctly**. Along the way they exposed **7 defects** in the application, one of them critical: **under concurrent use, claims are stored under the wrong customer**.

| | |
|---|---|
| **E2E / integration** (Playwright) | 10 tests: 7 pass; 3 are known defects that fail as expected (`test.fail()`) · about 1 minute |
| **Unit + component** (Vitest + Testing Library) | 42 tests, all pass; 2 are known defects that fail as expected (`it.fails`) · about 40 seconds |
| **Strategy, defects and decisions in full** | [NOTES.md](NOTES.md) |
| **How AI was used** | [.claude/ai-journal.md](.claude/ai-journal.md) · [prompts/](prompts/) |

**Contents:** [About the application](#1-about-the-application) · [What we tested](#2-what-we-tested) · [Why we chose it](#3-why-we-chose-these-tests) · [What we implemented](#4-what-we-implemented) · [Defects found](#5-defects-found) · [How to run](#6-how-to-run) · [Repository layout](#7-repository-layout) · [API reference](#8-api-reference) · [Further documentation](#9-further-documentation)

---

## 1. About the application

The application under test was supplied for the assessment, in [`tech-assess-qa/demo-app/`](tech-assess-qa/demo-app/). Its source code was not modified. It's an insurance-claims platform with two kinds of user:

| Role | Can do |
|---|---|
| **Claimant** (customer) | Sign up, log in, submit a claim through a 3-step wizard, see "My Claims", open a claim's details, get live status updates |
| **Admin** (staff) | Log in to a dashboard with claim statistics, view all claims, change a claim's status (Submitted → Under Review → Approved / Rejected → Closed), view users, flush the cache |

### Architecture

```
Browser ──► UI  Next.js 16 / React 19 :3001 ──► BFF  Spring Boot 4 :8090 ──► Claims service  Spring Boot 4 :8080/8081 ──► PostgreSQL
                                                  │   ▲  WebSocket (live updates)       │
                                                  ▼   │                                 ▼
                                          Keycloak 26 :8180 (OAuth2 login)     Kafka (claim events → BFF → UI)
                                          Redis :6379 (cache)
```

| Component | Technology | Role |
|---|---|---|
| UI | Next.js 16, React 19, Zustand, Zod, React Hook Form | Screens, browser-side validation, generated OpenAPI client |
| BFF (Backend-for-Frontend) | Spring Boot 4, Java 21 | The single API the UI calls: auth cookies, CSRF, calls to the claims service, WebSocket hub |
| Claims service | Spring Boot 4, Java 21, Liquibase | Claim and user records, status rules, Kafka events |
| Keycloak | Keycloak 26 | Login (OAuth2/OIDC), roles, brute-force protection |
| Data and messaging | PostgreSQL 15, Redis 7, Kafka | Storage, cache, events |

The full architecture is described in [ARCHITECTURE.md](tech-assess-qa/demo-app/ARCHITECTURE.md).

---

## 2. What we tested

### Coverage by feature

| Feature | Tested? | How |
|---|---|---|
| Login: both roles, invalid credentials, empty form | ✅ | 5 E2E tests |
| Submit a claim (3-step wizard) | ✅ | E2E: entered → reviewed → submitted → listed → details → **read back from the backend** |
| Claim wizard behaviour (validation, Back, step progression) | ✅ | E2E + component tests |
| Date display across timezones | ✅ | E2E (New York browser timezone) + unit tests |
| Claim ownership when many users act at once | ✅ | API-only concurrency test + a sequential control test |
| Validation rules (amount, location, description, dates) | ✅ | Unit tests at every limit |
| Admin status-transition rules | ✅ (rules only) | Unit test: the UI rules pinned to the backend's rules |
| Admin dashboard, users page, cache controls | ❌ | Not tested (see §3) |
| Admin status change, end to end | ❌ | Next priority |
| Real-time WebSocket / Kafka updates | ❌ | Planned |
| Sign-up | ❌ | Not tested (see §3) |

### The test cases

| ID | Test case | Level | Tags | Result |
|---|---|---|---|---|
| L1 | Login page shows email, password, Log In and Sign up | E2E | `@login @smoke @regression` | ✅ |
| L2 | Admin credentials land on the admin dashboard | E2E | `@login @smoke @sanity @regression` | ✅ |
| L3 | Claimant credentials land on My Claims | E2E | `@login @smoke @sanity @regression` | ✅ |
| L4 | Invalid credentials show an error and stay on the login page | E2E | `@login @sanity @regression` | ✅ |
| L5 | Submitting empty fields shows validation messages | E2E | `@login @regression` | ✅ |
| C1 | Submitted claim is reviewed, listed in My Claims and shown in full in Claim Details | E2E + API | `@smoke @sanity @regression` | ✅ |
| C2 | Going Back from Supporting Details keeps the incident details | E2E | `@regression` | ❌ expected: **D4** |
| C3 | Review step shows the date the claimant picked (timezone behind UTC) | E2E | `@regression` | ❌ expected: **D1** |
| O1 | Control: claims submitted one at a time stay with their submitter | API | `@regression` | ✅ |
| O2 | Claims submitted concurrently stay with their submitter | API | `@regression` | ❌ expected: **D6** |

**C1 checks the claim in four places**, then confirms it in the backend:
1. The Review step shows exactly what was typed ("March 14, 2025", "$1,250.50", the location and the description).
2. Submit returns **201** with a claim ID, and the success message shows that same ID.
3. My Claims has **exactly one** row for that ID, with the right date, amount and "Submitted" status.
4. The Claim Details dialog shows every field.
5. Finally, a **separate API session** reads the claim from the BFF and gets the same values, which proves it was really stored.

The 42 unit and component tests live in `demo-app-ui/tests/`. They cover the validation limits, the status rules, the formatting, and wizard steps 1 and 2.

---

## 3. Why we chose these tests

Testing started with a **risk assessment** of the source code: where would a defect do the most damage, where is the logic most complex, and where are the hand-offs between systems most fragile?

| Area | Why it's high risk | What we did |
|---|---|---|
| **Claim submission** | It's the core business transaction. Values pass through a date picker, validation, a generated API client, the BFF, the claims service and the database. Every hop can change a value, and a wrong date or amount on a claim matters financially and legally. | The deepest test (C1): values checked at every stage, then read back from the backend |
| **Login and identity** | Spread over four systems (UI, BFF, Keycloak, claims service). The UI only checks that a login cookie *exists*; the real enforcement sits in the backend. | 5 login tests, plus the concurrency test (which found D6) |
| **Dates and timezones** | The code turns a calendar date into "UTC midnight" and then shows it in local time, a classic off-by-one bug. | E2E test in New York time + unit tests (found D1) |
| **Admin status rules** | Wrong transitions mean wrong payouts, and the app's own test for this logic doesn't even compile. | The UI rules unit-tested against the backend's rules. End-to-end coverage is next |
| **Real-time updates** | Asynchronous, across Kafka, the BFF and WebSocket: the most brittle integration point. | Not covered yet. It's the next big item |

### What we deliberately left out

| Not tested | Reason |
|---|---|
| Sign-up | Lower risk than claims, and every run would leave a new Keycloak user behind |
| Admin dashboard, users page, cache controls | Read-only views. Status changes are the riskier admin feature |
| Cross-browser and mobile layouts | The table/card switch is pure CSS. Desktop Chromium was enough for the time available |
| Visual regression and load testing | Bonus items. Functional correctness and finding real defects came first |

### Principles behind the choices

- **One deep journey beats many shallow tests.** The claim journey crosses every layer of the system.
- **Verify the outcome, not just the screen.** A green UI test proves nothing if the backend stored something different.
- **Test at the cheapest level that proves it.** Validation limits are unit-tested; the full journey is tested end to end.
- **Every failure gets a root cause.** Nothing was called "flaky", and no defect was reported, without evidence: logs, screenshots, code, and sometimes the database.

---

## 4. What we implemented

### The Playwright framework (`tests/e2e/`)

| Component | Files | What it does, and why |
|---|---|---|
| **Page objects** | `pages/LoginPage.ts`, `MyClaimsPage.ts`, `ClaimWizardPage.ts`, `ClaimDetailsModal.ts` | One class per screen; tests never contain raw selectors. If a screen changes, one file changes |
| **Custom fixtures** | `fixtures/test.ts` | Hands each test ready-made page objects and a **ready-logged-in claimant** (`loggedInClaimant`), so there's no repeated setup code |
| **API service** | `support/bff-api.ts` (`BffApiSession`) | A logged-in API session without a browser: health check, login, submit, read back, logout. Used to prove claims were stored, and for the concurrency test |
| **Test data** | `test-data/users.json`, `claims.json`, `support/claim-data.ts` | Credentials and claim input kept out of the code. The expected display text is written as literals (e.g. `"Mar 14, 2025"`), so a formatting bug can't agree with itself. Each run gets a unique description |
| **Hooks** | in each spec + `support/hooks.ts` | `beforeAll`/`afterAll`: the shared API session · `beforeEach`: login page, or login + open the wizard · `afterEach`: a full-page screenshot when a test fails |
| **Tags** | `support/tags.ts` | `@smoke`, `@sanity`, `@regression`, `@login`, run with `npm run test:smoke` and so on. The tags are constants, so they can't be mistyped |
| **Known-defect markers** | `test.fail()` in specs | The suite stays green while each defect stays visible, and the test turns red once the defect is fixed |
| **Reporting** | `playwright.config.ts` | Terminal output, an HTML report, and the trace and video kept on failure |
| **Docker runner** | `Dockerfile`, `docker-compose.yml` | Runs the suite without installing Node or browsers (official Playwright image, pinned to 1.58.2) |

### Unit and component tests (`tech-assess-qa/demo-app/code/demo-app-ui/tests/`)

Vitest + Testing Library: `unit/claim-schemas`, `unit/claim-status-transitions`, `unit/formatting`, `component/wizard-step-1`, `component/wizard-step-2`. They query the screen by label and role, the way a user would, not by implementation details.

### Key design decisions

| Decision | Why |
|---|---|
| Tests in a **standalone package**, separate from the app | No coupling to the app's build, and reviewers find the tests immediately |
| **Claim ID taken from the server's response**, not the screen | It's the real record. The on-screen message is then checked *against* it |
| **One worker** | Parallel logins tripped Keycloak's lockout (D3), and parallel requests hit the BFF race (D6). D6 is tested deliberately by its own test instead |
| **Browser timezone pinned to UTC** | Expected dates are the same on every machine; the timezone test overrides it on purpose |
| **No fixed waits** | The tests wait on real signals (the page becoming interactive, a network response, the list loading), so there are no `sleep` calls |
| **No data clean-up** | The API has no delete endpoint, and unique descriptions keep runs independent |

---

## 5. Defects found

| # | Severity | Defect | Caught by |
|---|---|---|---|
| D6 | **Critical** (security) | The BFF shares one API client and swaps its login token on every request. Under concurrent use, **claims are stored under another user** (confirmed in the database) | `claim-ownership.spec.ts`: fails 5 of 5 runs; its sequential control passes 5 of 5 |
| D1 | High | Incident dates are **displayed one day early** for every user west of UTC | E2E + unit test |
| D2 | High (security) | The login form sends a **GET with the email and password in the URL** if it's submitted before the page has fully loaded | UI server log during E2E runs |
| D3 | Medium | A **locked account is reported as "Invalid email or password"**, which misleads users with the right password | Keycloak log during E2E runs |
| D4 | Medium | Going **Back** in the claim wizard **empties the incident date** field | E2E + component test |
| D7 | Low | Reading a claim you don't own returns **500** instead of 403/404 | `claim-ownership.spec.ts` |
| D5 | Low | "Submit New Claim" clicks are sometimes ignored (seen on the dev server) | E2E (handled with a targeted re-click) |

Evidence, reproduction steps, root causes and suggested fixes are in [NOTES.md](NOTES.md#4-defects-found).

---

## 6. How to run

**1. Start the app stack** (once). Follow [tech-assess-qa/demo-app/README.md](tech-assess-qa/demo-app/README.md) for Podman or Docker, then check it's up:

```bash
curl http://localhost:8090/actuator/health   # {"status":"UP"}
```

**2. Run the E2E tests** (under 5 minutes from a fresh clone):

```bash
cd tests/e2e
npm install
npx playwright install chromium
npm test                 # all 10 tests
npm run test:smoke       # or test:sanity / test:regression / test:login / test:claims
npm run report           # HTML report: steps, failure screenshots, traces
```

Change the targets with `BASE_URL` (UI, default `http://localhost:3001`) and `BFF_URL` (default `http://localhost:8090`).

**Or run them in a container** (no local Node.js or browsers needed):

```bash
cd tests/e2e
docker compose run --rm e2e-tests                       # Podman: podman compose run --rm e2e-tests
docker compose run --rm e2e-tests npm run test:smoke
```

The container uses host networking because the UI's browser code calls the BFF at `localhost`. On Docker Desktop this needs version 4.34+ with host networking enabled.

**3. Run the unit and component tests** (no stack needed):

```bash
cd tech-assess-qa/demo-app/code/demo-app-ui
npm install
npm test
```

| Command (in `tests/e2e`) | Runs |
|---|---|
| `npm test` | All 10 E2E tests |
| `npm run test:smoke` | `@smoke`: is the app up, and can each role get in? (4 tests) |
| `npm run test:sanity` | `@sanity`: do the core flows work? (4 tests) |
| `npm run test:regression` | `@regression`: everything, including edge cases and known defects (10 tests) |
| `npm run test:login` | `@login`: authentication (5 tests) |
| `npm run test:claims` | The 3 claim-creation tests |

> In the output, the 3 known-defect tests show `x` while the summary says "passed". That's expected: they're marked `test.fail()`.

---

## 7. Repository layout

```
README.md                  you are here
NOTES.md                   test strategy, risk assessment, defects D1–D7, decisions and assumptions
prompts/                   the prompts given to the AI, in order
.claude/ai-journal.md      what was accepted, challenged and overridden, and why
tests/e2e/                 the Playwright framework (see tests/e2e/README.md)
  specs/                   login, claims (UI journey), claim-ownership (API concurrency)
  pages/                   page objects: Login, My Claims, Claim Wizard, Claim Details dialog
  fixtures/                extended `test` with page objects and a logged-in claimant
  support/                 API session, claim data builder, hooks, tags
  test-data/               users and claims, with the exact text the UI should show
  Dockerfile, docker-compose.yml   run the suite in a container
tech-assess-qa/demo-app/   the application under test, as supplied
  code/demo-app-ui/tests/  unit/ and component/ tests (Vitest), with vitest.config.ts
```

---

## 8. API reference

The tests are written against the application's own contracts:

- BFF (what the UI and the tests call): [bff-api.yml](tech-assess-qa/demo-app/code/bff-service/src/main/resources/openapi/bff-api.yml). Swagger UI at http://localhost:8090/swagger-ui.html
- Claims service: [claims-api.yml](tech-assess-qa/demo-app/code/claims-service/src/main/resources/openapi/claims-api.yml)
- Kafka events: [claim-events-api.yml](tech-assess-qa/demo-app/code/claims-service/src/main/resources/asyncapi/claim-events-api.yml) (AsyncAPI)

Endpoints used by the tests: `POST /api/auth/login`, `GET /api/auth/csrf`, `POST /api/auth/logout`, `POST /api/claims`, `GET /api/claims/{id}`, `GET /actuator/health`.

---

## 9. Further documentation

| Document | What's in it |
|---|---|
| [NOTES.md](NOTES.md) | Full risk assessment, every defect with evidence and root cause, decisions, what's next |
| [tests/e2e/README.md](tests/e2e/README.md) | How the framework is built: layout, hooks, tags, conventions |
| [.claude/ai-journal.md](.claude/ai-journal.md) | Where AI helped, and what was challenged or overridden |
| [prompts/](prompts/) | Every prompt given to the AI, word for word |

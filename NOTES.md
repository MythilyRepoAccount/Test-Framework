# Notes: test strategy, findings, decisions and assumptions

## 1. Risk assessment

I read the source before writing tests. These are the areas where a defect would do the most damage:

| Area | Why it's high risk | Covered? |
|---|---|---|
| **Claim submission data integrity** (date, amount, location, description) | It's the core business transaction. Values pass through a date picker, Zod, a generated OpenAPI client, the BFF and the claims service. Every hop is a chance to reformat, round or shift a value, and a wrong date or amount on an insurance claim matters legally and financially. | ✅ End to end, checked at four points |
| **Authentication and identity** (Next.js middleware → BFF cookies → Keycloak → claims service) | Spread over four systems. The middleware only checks that a cookie *exists* (its own comment says it isn't a security control), so the real enforcement sits in the BFF. Login errors are mapped coarsely. | ✅ Login cases. ✅ Claim ownership under concurrency (D6). ❌ Direct cross-user access attempts (see §5) |
| **Timezones and date handling** | The UI parses `YYYY-MM-DD` with `new Date()` (UTC midnight) and formats it in local time, a classic off-by-one. | ✅ Defect proven (E2E + unit) |
| **Admin status transitions** | Business rules in `claim-status-transitions.ts` and `ClaimStatus.canTransitionTo()`. The supplied `UpdateClaimStatusUseCaseTest` **doesn't compile**, which is a warning sign. | ✅ The UI rules are unit-tested against the backend's table. ❌ The end-to-end admin flow (see §5) |
| **Kafka → BFF → WebSocket real-time updates** | Asynchronous and spans several services: the most brittle integration point. | ❌ See §5 |

## 2. What I tested, and why

The claimant journey (**log in → create a claim → verify it**) goes through every layer: UI, BFF, Keycloak, claims service and Postgres. One well-checked journey there gives more confidence than many shallow tests.

The happy-path test checks the claim in **four places**:
1. The Review step shows exactly what was entered.
2. The `POST /api/claims` response returns 201 and a claim ID, and the toast shows the same ID.
3. The My Claims row shows the expected date, truncated description, amount and status. Exactly one row exists for that ID.
4. The Claim Details dialog shows every field. Then a **separate API session** gets the claim from the BFF, which proves it was saved and isn't just held in browser state.

The login tests cover the controls, both roles' redirects, invalid credentials and empty-form validation.

**API concurrency** (`claim-ownership.spec.ts`): claimant and admin each submit 20 claims at once, then read each back. A sequential **control** test with the same checks isolates concurrency as the cause of any failure. This is what proved D6.

**Unit tests** (Vitest, `demo-app-ui/tests/unit/`) cover the logic most likely to hide bugs, cheaply:
- `claim-schemas`: every validation limit on both sides (amount 0.01 / 1,000,000; location 5/200; description 10/1000; future dates; an empty amount).
- `claim-status-transitions`: the UI's allowed transitions, pinned to a literal copy of the backend's `canTransitionTo()` table, so the two sides can't drift apart unnoticed.
- `formatting`: currency, truncation at exactly 50 characters, and date display in UTC, India and New York time. New York time is D1.

**Component tests** (Testing Library, `demo-app-ui/tests/component/`) work through labels and roles, the way a user would. They cover: Next disabled until the step is valid, validation messages, progress to the next step with the data saved, the character counter, and Back. D4 is pinned at component level, which is faster and more precise than the E2E test.

## 3. What I left out on purpose

| Not tested | Reason |
|---|---|
| Signup | Lower risk than claims, and each run would leave a new Keycloak user behind. |
| Admin dashboard, users page, cache controls | Read-only views. Status transitions are the riskier admin feature (§5). |
| Visual regression, load | Bonus items. They add less than functional correctness for the same time. |
| Cross-browser and mobile layout | The table/card switch is CSS-only. Chromium on desktop was enough for the time box. |
| Wizard step 3, Claim Details dialog, admin components (component tests) | They need router and API mocking. Their behaviour is already covered end to end. |
| Java unit tests (JUnit) for the BFF and claims service | The highest-value one would pin D6 (a concurrent `ClaimsServiceAdapter` test). It's listed in §5. |

## 4. Defects found

Every defect is backed by a failing assertion, a server log line or a code reference.

### D6: BFF sends requests with another caller's token under concurrent load (Critical, security)
- **Observed:** during a normal 2-worker run, a claimant's claim submission was rejected with `400 "User not found with ID: 52599073-…"`. That ID is the **BFF's service account**, not the claimant (`9ebd9dd8-…`). The UI only showed "Failed to submit claim. Please try again."
- **Cause:** `ClaimsServiceAdapter` is a singleton holding **one shared `ApiClient`** bean (`RestClientConfig.claimsApiClient`). Every call mutates its bearer token before sending (`setUserBearerToken` / `setServiceAccountBearerToken` / `retryWithFreshToken`, lines 212–226). Login calls `getUser()`, which switches the shared client to the service-account token (`LoginUseCaseImpl:50`). Any request in flight at that moment goes out with the wrong token.
- **Impact (proven):** when two users act at once, **claims are filed under the other user**. In the database, claims submitted by `claimant@demo.com` were stored with `admin@demo.com`'s `user_id`, and vice versa. The submitter then can't see their own claim, and the other user owns it. Claim submissions also fail when they overlap any user's login (the service-account token is swapped in). By the same code path, `GET /api/claims` can return another user's claims.
- **Fix:** don't mutate shared client state per request. Pass the token per call (a request interceptor reading request-scoped context), or build a client per request.
- **Test:** `specs/claim-ownership.spec.ts`. Claimant and admin each submit 20 claims concurrently, then read each one back. It **failed 5 of 5 runs** (1–4 misattributed claims per run). A **control** test doing the same thing sequentially **passed 5 of 5**, which isolates concurrency as the cause.

### D7: Reading a claim you don't own returns 500 (Low)
- **Evidence:** in the D6 test, `GET /api/claims/{id}` for a claim owned by the other user returns **500**, not 403 or 404.
- **Impact:** an expected "not yours / not found" case shows up as a server error. That's noise in monitoring and a generic error message for the user.

### Observation: the CSRF token rotates on every POST
- The BFF issues a new `XSRF-TOKEN` cookie on every POST. Two POSTs from the same browser tab at the same moment can therefore get 403 (each invalidates the other's token). The UI's `csrfMiddleware` reads the cookie per request, so it is exposed if it ever sends parallel mutations. The D6 test gives each submission its own cookie jar to avoid this.

### D1: Incident date displayed one day early west of UTC (High)
- **Repro:** set the browser timezone to `America/New_York` and enter incident date 14 Mar 2025. The Review step shows **"March 13, 2025"**.
- **Cause:** `<input type="date">` with `valueAsDate` gives a Date at `2025-03-14T00:00Z`. `Intl.DateTimeFormat` then formats it in local time, which is 13 Mar in New York. The same pattern appears in the list and details views (generated models use `new Date("2025-03-14")`).
- **Impact:** every claimant in the Americas sees, and approves on the Review step, a wrong incident date.
- **Test:** `claims.spec.ts` › *claimant in a timezone behind UTC* (`test.fail`).

### D2: Login form can send credentials in the URL (High, security)
- **Evidence:** UI server log `GET /login?email=&password=` during a test run.
- **Cause:** the `<form>` in `app/(auth)/login/page.tsx` has no `method="post"`. If it's submitted before React hydrates (slow network, slow device), the browser does a native GET, which puts the email and password in the query string, browser history, proxy logs and server logs.
- **Fix:** add `method="post"` (and an `action` that isn't a GET), or disable the button until hydrated.
- **Test mitigation:** `LoginPage.goto()` waits for React hydration, so tests don't hit the race.

### D3: Account lockout reported as "Invalid email or password" (Medium)
- **Evidence:** Keycloak `LOGIN_ERROR ... error="user_temporarily_disabled", username="claimant@demo.com"`, while the UI showed "Invalid email or password" for the **correct** password.
- **Cause:** `KeycloakTokenAdapter` catches every `HttpClientErrorException` and throws `InvalidCredentialsException`.
- **Impact:** a locked-out user is told their password is wrong, so they retry and stay locked. Support can't tell the two cases apart.
- **Trigger:** around 6 claimant logins in quick succession (for example `--repeat-each=3`). The suite is designed to stay below this (§6).

### D4: Back from step 2 blanks the incident date (Medium)
- **Repro:** fill in step 1, press Next, then Back. The date input is **empty**; location and amount are kept.
- **Cause:** `WizardStep1` passes `defaultValues.incidentDate` as a `Date` object, but `<input type="date">` needs a `"YYYY-MM-DD"` string. The value is still held in the store, so the form *looks* invalid while the data is actually there.
- **Notable:** the earlier version of this test **re-typed step 1 after Back**, which hid this defect.
- **Test:** `claims.spec.ts` › *going Back … keeps the incident details* (`test.fail`).

### D5: "Submit New Claim" click sometimes ignored (Low, dev server only so far)
- **Evidence:** in failing runs no `/claims/new` request reached the server, or the wizard rendered while `location` still read `/claims`.
- **Caveat:** seen only on `next dev`, which is what the supplied compose file runs. It needs re-checking against a production build before being raised as a product bug.
- **Test mitigation:** `MyClaimsPage.startNewClaim()` re-clicks until the wizard heading is visible. This is documented in code, and it is *not* a blanket retry.

### Also noted (not a defect I proved)
- The supplied `UpdateClaimStatusUseCaseTest.java` doesn't compile (the app's README says to skip it), so the status-transition logic has no working test.
- The Next.js middleware only checks that the auth cookie exists. That's fine as long as every BFF endpoint enforces auth and ownership, which I haven't verified (§5, item 2).

## 5. With more time, in priority order

1. **JUnit test pinning D6 at the source:** call `ClaimsServiceAdapter` from many threads with different tokens, and assert that each outgoing request carries its own caller's token. It's faster and more precise than the API test, and it would guard the fix.
2. **Admin status transitions, end to end:** API tests for every allowed and forbidden transition (the UI rules are already unit-tested against the backend table), plus fixing the broken `UpdateClaimStatusUseCaseTest`. Wrong transitions mean wrong payouts.
3. **Authorisation on the BFF:** can claimant A `GET /api/claims/{id}` for claimant B's claim on purpose (not just through the race)? Can a claimant call `/api/admin/**`? This needs a second claimant account.
4. **Real-time updates:** an admin changes a status, and the claimant's open My Claims page updates over WebSocket without a reload (two browser contexts). Then a Kafka contract test against the AsyncAPI schemas.
5. **Server-side validation:** submit out-of-range values straight to the BFF to confirm the backend enforces what the UI enforces (the UI limits are already unit-tested).
6. CI pipeline (compose up → unit → smoke → regression), then k6 for claim submission throughput. k6 would also expose D6 under load.

## 6. Decisions and assumptions

| Decision | Why |
|---|---|
| Tests in a **standalone `tests/e2e/` package**, not inside the UI app | The test code doesn't import app code, so it isn't coupled to the Next.js build. Reviewers find it immediately. |
| **Expected values are literal strings** in `test-data/claims.json` (`"Mar 14, 2025"`, `"$1,250.50"`), not computed with the app's formatters | If the test used the app's own formatter, a formatting bug would pass. D1 was found because the expected value is independent. |
| **Claim ID read from the network response**, not scraped from the toast | It's the system of record, and it avoids parsing UI text. |
| **Known defects marked `test.fail()`** rather than left red | The suite stays green, while each defect stays visible as "expected to fail" and flips to a failure once it's fixed, which prompts removing the marker. |
| **Browser timezone pinned to UTC** in config | Makes expected dates deterministic on any machine. The D1 test overrides it on purpose. |
| **One shared API session** per claims suite (`beforeAll` / `afterAll`) | Avoids an extra Keycloak login per test, which would trip the lockout (D3). `afterAll` logs it out. |
| **No data cleanup** | The API has no DELETE endpoint. Each claim gets a unique description, so leftover data never affects later runs. |
| **Test timeout 60s** (default 30s) | The supplied stack runs `next dev`, and a cold compile of `/claims/new` took about 14s. This is an environment allowance, not a performance assertion. |
| **Docker runner uses host networking** | Required, not a shortcut. The UI's browser code calls the BFF at `localhost:8090` (baked into the UI build), the WebSocket only allows the `localhost:3001` origin, and the cookies are `SameSite=Strict`. |
| **Login redirect timeout 15s** (`LoginPage.expectRedirectedTo`) | A Keycloak round trip plus a full page load took just over 5s in the container. The longer timeout applies to this one assertion, not to every expect. |
| **One worker** (`workers: 1`) | With 2 workers, parallel claimant logins tripped the lockout (D3) and the D6 race made the happy path fail intermittently. D6 is now reproduced **deliberately** by its own test, so serialising the rest gives a reliable suite without hiding the defect. (This replaces an earlier choice to keep 2 workers.) |
| **UI login in every test**, no `storageState` | A deliberate earlier choice: login is part of the journey under test. The cost is about 3s per test. |
| Login suite **split into 5 tests** (it used to be one test with steps) | Needed for per-case tags and hooks, and failures now report independently. |

**Assumptions:** the seeded users `admin@demo.com` and `claimant@demo.com` exist (from the Keycloak realm import). Ports are as in the app's README (the BFF on 8090). Tests run against a dedicated local stack, not a shared environment. The two spec files may run in parallel workers, and tests within a file run in order.

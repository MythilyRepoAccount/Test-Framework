# AI working journal

**Tool:** Claude Code (Claude Opus 5.5) in VS Code. The prompts are in [prompts/](../prompts/).
**How I worked:** the AI generated the code and proposed causes for failures. Nothing was accepted on a hypothesis alone. Each claim was checked against evidence (server logs, Keycloak events, failure screenshots, page snapshots) before it was kept.

## Accepted

| What the AI proposed | Why I kept it |
|---|---|
| Read the claim ID from the `POST /api/claims` response rather than scraping the toast | That's the system of record. The toast is then asserted *against* it. |
| Put expected display strings in `claims.json` as literals (`"Mar 14, 2025"`) instead of importing the app's `formatDate` | Using the app's own formatter would make a formatting bug pass. This is exactly how D1 was found. |
| Add a check through a separate API session that the claim was saved | It proves the backend persisted the claim, not just that the UI showed it. |
| Mark proven defects with `test.fail()` and a reason | The suite stays green while defects stay visible, and each one flips to a failure when fixed. |
| Split the page object into Wizard, My Claims and Details dialog, plus fixtures | Each has a single responsibility, and setup isn't copy-pasted (DRY). |

## Challenged: the AI's first explanation was wrong or incomplete

| AI's first take | Evidence | What changed |
|---|---|---|
| "Submit New Claim" click dropped → hydration race; wait for the claims list | The screenshot showed a fully loaded list, so hydration was ruled out. UI server logs showed **no** `/claims/new` request in one run. In another run the page snapshot showed the **wizard rendered while the URL still read `/claims`**. | The assertion moved from the URL to the visible wizard heading, with a targeted re-click. Logged as D5 (low; dev server only, needs re-checking on a production build). |
| Valid claimant login rejected → looked like a test flake | The Keycloak log showed `user_temporarily_disabled` for the correct password, and the BFF maps every 4xx to "invalid credentials". | Raised as **defect D3**. Deliberately **not** worked around. The suite design (one shared API session) keeps login volume under the lockout threshold. |
| Empty-form login test failed → slow server | The UI log showed `GET /login?email=&password=`: a native form submit before React hydrated. | Raised as **security defect D2**. The test now waits on React's hydration marker on the form (deterministic, no sleep). |
| Happy path timed out → the toPass budget was too short | The UI log showed a cold `next dev` compile of `/claims/new` taking 13.7s while another worker was also loading pages. | Test timeout raised from 30s to 60s and recorded as an environment allowance in NOTES.md, not hidden. |

| Admin login failed in the container → container networking broken? | The trace showed the app *did* navigate to `/admin/dashboard`, and the server rendered it in 0.9s. A Keycloak round trip plus a full page load just exceeded the 5s expect timeout. 7 of 8 passed, so host networking worked. | A named 15s timeout for the login redirect only (`LoginPage.expectRedirectedTo`). Not a global increase. |
| Happy path failed locally right after passing in the container → "flaky" | The page showed "Failed to submit claim". The BFF log showed `400 User not found` for **the service account's ID**, and the adapter code showed a singleton `ApiClient` whose bearer token is mutated per request. | Raised as **critical defect D6**. Workers were deliberately kept at 2, since serialising the specs would hide it. |

| First D6 concurrency test failed, so D6 looked proven | A **sequential control** with the same checks also failed with 403s. Probing showed the BFF **rotates the CSRF cookie on every POST**, so concurrent POSTs sharing one cookie jar invalidated each other. That was a test-harness artifact, not D6. | Each submission now runs in its own cookie jar. Afterwards: the control passed 5 of 5 and the concurrent test failed 5 of 5. The database confirmed claims stored under the **other** user. CSRF rotation was recorded as an observation. |
| `it.fails` known-defect tests in Vitest "passed" (failed as expected) | Without checking, they could be failing for the wrong reason (for example, runtime `TZ` not honoured on Windows). | Ran temporary copies as plain `it`: D1 printed `Mar 13, 2025` and D4 showed an empty date input. The right reasons in both cases. |

## Overridden: existing code or AI defaults I rejected

| What was there | Override | Reason |
|---|---|---|
| The original claim test **re-typed step 1 after pressing Back** | Assert that the values are kept instead | The re-typing was hiding defect D4. |
| The original claim test **ended at submit**, checking only that a button was visible again | Check the claim in 4 places | A test that passes whatever got saved gives no confidence. |
| Login was **one test with 5 steps** (an earlier stated preference) | 5 separate tests | Tags and `beforeEach` apply per test, and failures now report independently. *(Flagged for my sign-off.)* |
| A default `afterAll` that "cleans up" claims | No data cleanup; `afterAll` only logs out the API session | There's no DELETE endpoint, so pretending to clean up would be misleading. Unique descriptions make leftovers harmless. |
| Playwright's built-in `screenshot: 'only-on-failure'` alongside the requested `afterEach` hook | Turned the config option off | Otherwise every failure gets two screenshots. |
| An earlier choice to keep **2 E2E workers** to expose D6 | `workers: 1` | Back-to-back runs tripped the Keycloak lockout and made the happy path intermittent. Once D6 had its own deliberate test, parallelism no longer earned its cost. |
| The slide's `src/api|domain|service|infrastructure` layout | Not applied | The app is supplied, and the deliverable is the test package. Restructuring someone else's code is out of scope. |

## Reviewer sign-off (to be completed by the candidate)

> Record your own decisions here before submitting: anything above you disagree with, and anything you changed by hand. The panel will probe these.

- [ ] I've read every test and can explain each assertion.
- [ ] Login split into 5 tests: agreed / reverted because…
- [ ] `test.fail()` for defects vs. leaving them red: agreed / changed because…

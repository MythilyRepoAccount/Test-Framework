# 05: Teardown and removed files (questions)

**Prompts:**
> here we have used tear down

> did we removed any folder and file in framework

**Outcome:** questions only, no code changes. Teardown: `afterAll` logs out and disposes the shared BFF API session; Playwright disposes each test's browser context; there's no data teardown because the API has no DELETE endpoint. Removed files: `ClaimsPage.ts` (split into 3 page objects) and the old `demo-app-ui/e2e/` docs and folder (moved to `tests/e2e/`). Since this isn't a git repo yet, the originals exist only in the conversation history.

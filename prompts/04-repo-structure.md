# 04: Repo structure for reviewers

**Prompt:**
> these image read it based on change my framework.

**Attached:** slides titled "What The Examiner Is Silently Asking" (run in under 5 minutes? architecture obvious from the folders? decisions explained? tests pass?), "The Recommended Shape" (`README.md`, `src/{api,domain,service,infrastructure}`, `test/`, `resources/openapi`, `docker-compose.yml`, `NOTES.md`, `prompts/`, `.claude/ai-journal.md`), "Why Structure Matters", plus examples of a passing test list, an OpenAPI contract and a README with Overview / Architecture / Setup / API Reference / Testing sections.

**Outcome:** tests moved out of the app into a standalone `tests/e2e/` package. Added a root `README.md` with the slide's sections, `NOTES.md`, `prompts/` and `.claude/ai-journal.md`. The `src/api|domain|service|infrastructure` layout was **not** applied, because the app under test is supplied and is not the deliverable.

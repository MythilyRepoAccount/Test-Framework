# 06: Docker

**Prompt:**
> add docker related file and keep this file also in framework .

**Outcome:** added `Dockerfile`, `docker-compose.yml` and `.dockerignore` inside `tests/e2e/`, to run the suite in the official Playwright image (pinned to 1.58.2 to match the package). The container uses **host networking**. That's required because the UI's browser code calls the BFF at `localhost:8090`, the WebSocket only allows the `localhost:3001` origin, and the auth cookies are `SameSite=Strict` on localhost.

**Follow-up prompt:**
> how to run the framework give me all commands and run the test

**Outcome:** 8 of 8 passed in the container and locally. A later local run exposed **D6 (critical)**: the BFF's shared `ApiClient` sends a claim submission with the service-account token when it overlaps a login.

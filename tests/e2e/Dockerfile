# Runs the E2E suite in a container with Chromium and its OS dependencies preinstalled.
# The image tag must match @playwright/test in package.json so the bundled browsers match.
FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /e2e

# Install dependencies first so this layer is cached until package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Override at run time, e.g. `docker compose run --rm e2e-tests npm run test:smoke`.
CMD ["npm", "test"]

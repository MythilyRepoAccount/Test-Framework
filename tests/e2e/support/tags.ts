/**
 * Test tags, selectable with `--grep` (see package.json e2e:* scripts).
 *
 * smoke      - is the app up and can each role get in? Run on every deploy.
 * sanity     - do the core business flows work? Run after any change to them.
 * regression - the full suite, including edge cases and known-defect checks.
 * login      - everything that exercises authentication.
 */
export const Tag = {
  smoke: '@smoke',
  sanity: '@sanity',
  regression: '@regression',
  login: '@login',
} as const;

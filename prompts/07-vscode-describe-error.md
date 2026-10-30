# 07: Red `test.describe` in VS Code

**Prompts:**
> in specs folder y test.describe showing red color

> fix  describe issue in test ffile

> still showing in red color

**Outcome:** the error came from the Playwright VS Code extension ("did not expect test.describe() to be called here"), not from TypeScript. The spec files were fine and needed no changes.

- **First cause found:** a leftover `@playwright/test` in `demo-app-ui`, which reproduced the error. It was only there for the old in-app tests and no app code imports it, so it was uninstalled. That alone did **not** clear the error.
- **Actual cause:** a separate Playwright 1.62.1 starter project in the user's home folder (`C:\Users\Dell`). The repo root has no `package.json`, so the extension walks up to the home folder's `node_modules`. It then loads the specs with 1.62.1 while they import 1.58.2 from `tests/e2e`. Reproduced exactly with that copy.
- **Decision (user):** change nothing. Open `tests/e2e` as the VS Code folder when working on tests. This is local to this machine; a reviewer's clone is unaffected.


import type { Page, TestInfo } from '@playwright/test';

/**
 * afterEach hook body: attaches a full-page screenshot to the report when a test
 * fails or times out. Also runs for `test.fail()` known-defect tests, so the report
 * holds visual evidence of each defect.
 */
export async function captureScreenshotOnFailure(
  { page }: { page: Page },
  testInfo: TestInfo
): Promise<void> {
  if (testInfo.status === 'passed' || testInfo.status === 'skipped') return;

  await testInfo.attach('failure-screenshot', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

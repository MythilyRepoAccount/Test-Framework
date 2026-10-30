import { test, expect } from '../fixtures/test';
import { captureScreenshotOnFailure } from '../support/hooks';
import { Tag } from '../support/tags';
import users from '../test-data/users.json';

/*
 * Hooks used in this file:
 *  - beforeEach: every login case starts from a freshly loaded login page.
 *  - afterEach:  attach a screenshot when a case fails.
 * No beforeAll/afterAll: each test gets its own browser context, so there is no
 * shared state to set up, and a failed login leaves nothing to clean up.
 */
test.describe('Login', { tag: Tag.login }, () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test.afterEach(captureScreenshotOnFailure);

  test('login page shows the email, password, Log In and Sign up controls', {
    tag: [Tag.smoke, Tag.regression],
  }, async ({ loginPage }) => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
    await expect(loginPage.signupLink).toBeVisible();
  });

  test('admin credentials land on the admin dashboard', {
    tag: [Tag.smoke, Tag.sanity, Tag.regression],
  }, async ({ loginPage }) => {
    await loginPage.login(users.admin.email, users.admin.password);
    await loginPage.expectRedirectedTo(/\/admin\/dashboard(?:[/?#]|$)/);
  });

  test('claimant credentials land on My Claims', {
    tag: [Tag.smoke, Tag.sanity, Tag.regression],
  }, async ({ loginPage }) => {
    await loginPage.login(users.claimant.email, users.claimant.password);
    await loginPage.expectRedirectedTo(/\/claims(?:[/?#]|$)/);
  });

  test('invalid credentials show an error and stay on the login page', {
    tag: [Tag.sanity, Tag.regression],
  }, async ({ page, loginPage }) => {
    await loginPage.login(users.invalid.email, users.invalid.password);
    await expect(page.getByRole('alert').filter({ hasText: 'Invalid email or password' })).toBeVisible();
    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
  });

  test('submitting empty fields shows validation messages', {
    tag: Tag.regression,
  }, async ({ page, loginPage }) => {
    await loginPage.loginButton.click();
    await expect(page.getByText('Invalid email format')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });
});

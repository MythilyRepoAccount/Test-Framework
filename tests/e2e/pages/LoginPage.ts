import { expect, type Locator, type Page } from '@playwright/test';

/**
 * A successful login is a Keycloak round trip followed by a full page load
 * (window.location), which can exceed the default 5s expect timeout on the dev server.
 */
const LOGIN_REDIRECT_TIMEOUT = 15_000;

/** Page Object for the existing app/(auth)/login/page.tsx login screen. */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly signupLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    // The accessible name "Password" can also match the Show password button.
    // Target the password input directly to avoid a strict-mode locator error.
    this.passwordInput = page.locator('#password');
    this.loginButton = page.getByRole('button', { name: 'Log In' });
    this.signupLink = page.getByRole('link', { name: 'Sign up' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await expect(this.page.getByRole('heading', { name: 'Log In' })).toBeVisible();
    await this.waitForHydration();
  }

  /**
   * The form is server-rendered without method="post", so a click before React hydrates
   * does a native GET submit (/login?email=&password=). React sets a __reactProps$ key on
   * host elements when it attaches handlers, so wait for that on the form.
   */
  private async waitForHydration(): Promise<void> {
    await this.page.waitForFunction(() => {
      const form = document.querySelector('form');
      return form !== null && Object.keys(form).some((key) => key.startsWith('__reactProps$'));
    });
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async expectRedirectedTo(landingUrl: RegExp): Promise<void> {
    await expect(this.page).toHaveURL(landingUrl, { timeout: LOGIN_REDIRECT_TIMEOUT });
  }
}

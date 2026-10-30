import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { MyClaimsPage } from '../pages/MyClaimsPage';
import { ClaimWizardPage } from '../pages/ClaimWizardPage';
import { ClaimDetailsModal } from '../pages/ClaimDetailsModal';
import users from '../test-data/users.json';

type PageObjects = {
  loginPage: LoginPage;
  myClaimsPage: MyClaimsPage;
  claimWizard: ClaimWizardPage;
  claimDetails: ClaimDetailsModal;
  /** Logs in through the UI as the claimant and lands on My Claims. */
  loggedInClaimant: MyClaimsPage;
};

export const test = base.extend<PageObjects>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  myClaimsPage: async ({ page }, use) => use(new MyClaimsPage(page)),
  claimWizard: async ({ page }, use) => use(new ClaimWizardPage(page)),
  claimDetails: async ({ page }, use) => use(new ClaimDetailsModal(page)),

  loggedInClaimant: async ({ loginPage, myClaimsPage }, use) => {
    await loginPage.goto();
    await loginPage.login(users.claimant.email, users.claimant.password);
    await loginPage.expectRedirectedTo(/\/claims(?:[?#]|$)/);
    await myClaimsPage.expectLoaded();
    await use(myClaimsPage);
  },
});

export { expect };

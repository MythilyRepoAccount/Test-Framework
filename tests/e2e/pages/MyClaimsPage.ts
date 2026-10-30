import { expect, type Locator, type Page } from '@playwright/test';
import { shortClaimId } from '../support/claim-data';

/** Page Object for app/(authenticated)/claims — the claimant's "My Claims" list. */
export class MyClaimsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly submitNewClaimButton: Locator;
  readonly claimsTable: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'My Claims', level: 1 });
    this.submitNewClaimButton = page.getByRole('button', { name: 'Submit New Claim', exact: true });
    // Desktop viewport renders the table; the mobile card list is CSS-hidden.
    this.claimsTable = page.getByRole('table');
    this.emptyState = page.getByRole('heading', { name: 'No claims yet' });
  }

  /**
   * The list (or empty state) only renders after the client-side claims fetch,
   * which proves React has hydrated — clicking the SSR'd buttons earlier is a no-op.
   */
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/claims(?:[?#]|$)/);
    await expect(this.heading).toBeVisible();
    await expect(this.claimsTable.or(this.emptyState)).toBeVisible();
  }

  /**
   * The button's router.push is intermittently dropped on the Next.js dev server,
   * so re-click until the wizard renders. Asserting on the rendered heading rather
   * than the URL, because the dev router can lag updating location after rendering.
   * The budget covers a cold dev-server compile of /claims/new (observed up to ~14s).
   */
  async startNewClaim(): Promise<void> {
    const wizardHeading = this.page.getByRole('heading', { name: 'Submit New Claim', level: 1 });
    await expect(async () => {
      await this.submitNewClaimButton.click();
      await expect(wizardHeading).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  }

  claimRow(claimId: string): Locator {
    return this.claimsTable
      .getByRole('row')
      .filter({ has: this.page.locator('code', { hasText: shortClaimId(claimId) }) });
  }

  /** Cells in column order: Claim ID, Date, Description, Amount, Status, Actions. */
  claimCells(claimId: string): Record<'date' | 'description' | 'amount' | 'status', Locator> {
    const cells = this.claimRow(claimId).getByRole('cell');
    return {
      date: cells.nth(1),
      description: cells.nth(2),
      amount: cells.nth(3),
      status: cells.nth(4),
    };
  }

  async openClaimDetails(claimId: string): Promise<void> {
    await this.claimRow(claimId).getByRole('button', { name: 'View Details' }).click();
  }
}

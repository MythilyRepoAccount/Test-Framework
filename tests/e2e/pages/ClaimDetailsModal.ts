import { expect, type Locator, type Page } from '@playwright/test';

/** Component Object for src/features/claims/components/claim-detail-modal.tsx. */
export class ClaimDetailsModal {
  readonly dialog: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Claim Details' });
    this.closeButton = this.dialog.getByRole('button', { name: 'Close' });
  }

  /** Detail fields are rendered as <dt>label</dt><dd>value</dd>. */
  field(label: string): Locator {
    return this.dialog.locator(`xpath=.//dt[normalize-space()='${label}']/following-sibling::dd[1]`);
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
    // Fields render only once GET /api/claims/{id} has resolved.
    await expect(this.field('Claim ID')).toBeVisible();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.dialog).toBeHidden();
  }
}

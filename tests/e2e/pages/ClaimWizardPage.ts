import { expect, type Locator, type Page } from '@playwright/test';
import type { ClaimInput } from '../support/claim-data';

/** Page Object for app/(authenticated)/claims/new — the three-step claim wizard. */
export class ClaimWizardPage {
  readonly page: Page;

  readonly incidentDetailsStep: Locator;
  readonly supportingDetailsStep: Locator;
  readonly reviewStep: Locator;

  readonly incidentDateInput: Locator;
  readonly incidentLocationInput: Locator;
  readonly claimAmountInput: Locator;
  readonly descriptionInput: Locator;

  constructor(page: Page) {
    this.page = page;

    this.incidentDetailsStep = page.getByTestId('wizard-step-1');
    this.supportingDetailsStep = page.getByTestId('wizard-step-2');
    this.reviewStep = page.getByTestId('wizard-step-3');

    this.incidentDateInput = page.locator('#incidentDate');
    this.incidentLocationInput = page.locator('#incidentLocation');
    this.claimAmountInput = page.locator('#claimAmount');
    this.descriptionInput = page.locator('#description');
  }

  private button(step: Locator, name: string): Locator {
    return step.getByRole('button', { name, exact: true });
  }

  async expectOpen(): Promise<void> {
    await expect(this.incidentDetailsStep).toBeVisible();
  }

  async fillIncidentDetails(claim: ClaimInput): Promise<void> {
    await this.incidentDateInput.fill(claim.incidentDate);
    await this.incidentLocationInput.fill(claim.incidentLocation);
    await this.claimAmountInput.fill(claim.claimAmount);
  }

  async continueToSupportingDetails(): Promise<void> {
    await this.button(this.incidentDetailsStep, 'Next').click();
    await expect(this.supportingDetailsStep).toBeVisible();
  }

  async backToIncidentDetails(): Promise<void> {
    await this.button(this.supportingDetailsStep, 'Back').click();
    await expect(this.incidentDetailsStep).toBeVisible();
  }

  async fillDescription(description: string): Promise<void> {
    await this.descriptionInput.fill(description);
  }

  async continueToReview(): Promise<void> {
    await this.button(this.supportingDetailsStep, 'Next').click();
    await expect(this.reviewStep).toBeVisible();
  }

  /** Review fields are rendered as <h3>label</h3><p>value</p>. */
  reviewValue(label: string): Locator {
    return this.reviewStep.locator(
      `xpath=.//h3[normalize-space()='${label}']/following-sibling::p[1]`
    );
  }

  async expectReviewShows(claim: ClaimInput): Promise<void> {
    await expect(this.reviewValue('Incident Date')).toHaveText(claim.expected.reviewDate);
    await expect(this.reviewValue('Location')).toHaveText(claim.incidentLocation);
    await expect(this.reviewValue('Claim Amount')).toHaveText(claim.expected.amount);
    await expect(this.reviewValue('Description')).toHaveText(claim.description);
  }

  /**
   * Submits the claim and returns the claim ID issued by the backend, read from
   * the POST /api/claims response rather than scraped from the UI.
   */
  async submit(): Promise<string> {
    const submitResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/claims'
    );
    await this.button(this.reviewStep, 'Submit Claim').click();

    const response = await submitResponse;
    expect(response.status(), 'claim submission HTTP status').toBe(201);
    const { claimId } = (await response.json()) as { claimId: string };
    expect(claimId, 'claim ID returned by the BFF').toBeTruthy();
    return claimId;
  }
}

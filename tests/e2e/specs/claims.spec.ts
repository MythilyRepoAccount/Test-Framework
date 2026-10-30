import { test, expect } from '../fixtures/test';
import { BffApiSession } from '../support/bff-api';
import { buildValidClaim, listDescription, type ClaimInput } from '../support/claim-data';
import { captureScreenshotOnFailure } from '../support/hooks';
import { Tag } from '../support/tags';
import users from '../test-data/users.json';

/*
 * Hooks used in this file:
 *  - beforeAll:  fail fast if the stack is down, and open ONE API session as the claimant,
 *                independent of the browser. It is used to prove a claim is persisted
 *                server-side, and sharing it avoids an extra Keycloak login per test
 *                (rapid logins trip Keycloak's brute-force lockout).
 *  - afterAll:   log that API session out (ends its Keycloak session) and dispose it.
 *                Created claims are not deleted: the API has no DELETE endpoint, and each
 *                claim has a unique description, so leftovers never collide with later runs.
 *  - beforeEach: log in through the UI as the claimant and open the claim wizard.
 *  - afterEach:  attach a screenshot when a test fails.
 */
test.describe('Claim creation', () => {
  let bffApi: BffApiSession;
  let claim: ClaimInput;

  test.beforeAll(async ({ playwright }) => {
    bffApi = await BffApiSession.start(playwright, users.claimant);
  });

  test.afterAll(async () => {
    await bffApi?.end();
  });

  test.beforeEach(async ({ loggedInClaimant, claimWizard }) => {
    claim = buildValidClaim();
    await loggedInClaimant.startNewClaim();
    await claimWizard.expectOpen();
  });

  test.afterEach(captureScreenshotOnFailure);

  test('submitted claim is reviewed, listed in My Claims and shown in full in Claim Details', {
    tag: [Tag.smoke, Tag.sanity, Tag.regression],
  }, async ({ page, claimWizard, myClaimsPage, claimDetails }) => {
    let claimId = '';

    await test.step('enter incident and supporting details', async () => {
      await claimWizard.fillIncidentDetails(claim);
      await claimWizard.continueToSupportingDetails();
      await claimWizard.fillDescription(claim.description);
      await claimWizard.continueToReview();
    });

    await test.step('review step shows exactly what was entered', async () => {
      await claimWizard.expectReviewShows(claim);
    });

    await test.step('submit returns a claim ID and confirms it to the user', async () => {
      claimId = await claimWizard.submit();
      await expect(page.getByText(`Claim submitted successfully! Claim ID: ${claimId}`)).toBeVisible();
      await myClaimsPage.expectLoaded();
    });

    await test.step('new claim is listed in My Claims with its submitted values', async () => {
      const cells = myClaimsPage.claimCells(claimId);
      await expect(myClaimsPage.claimRow(claimId)).toHaveCount(1);
      await expect(cells.date).toHaveText(claim.expected.listDate);
      await expect(cells.description).toHaveText(listDescription(claim.description));
      await expect(cells.amount).toHaveText(claim.expected.amount);
      await expect(cells.status).toHaveText(claim.expected.status);
    });

    await test.step('Claim Details shows every submitted field', async () => {
      await myClaimsPage.openClaimDetails(claimId);
      await claimDetails.expectOpen();

      await expect(claimDetails.field('Claim ID')).toHaveText(claimId);
      await expect(claimDetails.field('Status')).toHaveText(claim.expected.status);
      await expect(claimDetails.field('Incident Date')).toHaveText(claim.expected.listDate);
      await expect(claimDetails.field('Incident Location')).toHaveText(claim.incidentLocation);
      await expect(claimDetails.field('Description')).toHaveText(claim.description);
      await expect(claimDetails.field('Claim Amount')).toHaveText(claim.expected.amount);

      await claimDetails.close();
    });

    await test.step('claim is persisted: a separate API session reads back the submitted values', async () => {
      const response = await bffApi.getClaim(claimId);
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        claimId,
        status: claim.expected.apiStatus,
        incidentDate: claim.incidentDate,
        incidentLocation: claim.incidentLocation,
        description: claim.description,
        claimAmount: Number(claim.claimAmount),
      });
    });
  });

  test('going Back from Supporting Details keeps the incident details already entered', {
    tag: Tag.regression,
  }, async ({ claimWizard }) => {
    // Known defect: the date is kept in wizard state but the <input type="date"> renders
    // blank, because defaultValues passes a Date object rather than a "YYYY-MM-DD" string.
    test.fail(true, 'DEFECT: incident date input is blank after navigating Back');

    await claimWizard.fillIncidentDetails(claim);
    await claimWizard.continueToSupportingDetails();
    await claimWizard.backToIncidentDetails();

    await expect(claimWizard.incidentDateInput).toHaveValue(claim.incidentDate);
    await expect(claimWizard.incidentLocationInput).toHaveValue(claim.incidentLocation);
    await expect(claimWizard.claimAmountInput).toHaveValue(claim.claimAmount);
  });

  test.describe('claimant in a timezone behind UTC', () => {
    test.use({ timezoneId: 'America/New_York' });

    test('review step shows the incident date the claimant picked', {
      tag: Tag.regression,
    }, async ({ claimWizard }) => {
      // Known defect: the picked date is parsed as UTC midnight and then formatted in local
      // time, so anywhere west of UTC every incident date is displayed one day early.
      test.fail(true, 'DEFECT: incident date displayed one day early in negative UTC offsets');

      await claimWizard.fillIncidentDetails(claim);
      await claimWizard.continueToSupportingDetails();
      await claimWizard.fillDescription(claim.description);
      await claimWizard.continueToReview();

      await expect(claimWizard.reviewValue('Incident Date')).toHaveText(claim.expected.reviewDate);
    });
  });
});

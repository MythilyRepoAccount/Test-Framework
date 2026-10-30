import { test, expect } from '../fixtures/test';
import { BffApiSession, type SubmitClaimBody, type SubmitClaimResult } from '../support/bff-api';
import { buildValidClaim } from '../support/claim-data';
import { Tag } from '../support/tags';
import users from '../test-data/users.json';

/** Enough simultaneous requests per user to reliably overlap in the BFF. */
const CONCURRENT_SUBMISSIONS_PER_USER = 20;
const HTTP_OK = 200;
const HTTP_CREATED = 201;

/*
 * API-only (no browser): two users submit claims at the same time, then each reads
 * back its own claims one by one. Every claim must belong to the session that created it.
 *
 * Hooks used in this file:
 *  - beforeAll: open one API session per user (2 logins in total, well below the lockout).
 *  - afterAll:  log both sessions out and dispose them.
 */
test.describe('Claim ownership under concurrent use', { tag: Tag.regression }, () => {
  let claimant: BffApiSession;
  let admin: BffApiSession;

  test.beforeAll(async ({ playwright }) => {
    claimant = await BffApiSession.start(playwright, users.claimant);
    admin = await BffApiSession.start(playwright, users.admin);
  });

  test.afterAll(async () => {
    await claimant?.end();
    await admin?.end();
  });

  test('control: claims submitted one at a time are stored under their submitter', async () => {
    // Same checks without concurrency. If this passes and the concurrent test fails,
    // the failure is caused by concurrency, not by CSRF handling, roles or the harness.
    const submissions = {
      claimant: [await claimant.submitClaim(apiClaimBody()), await claimant.submitClaim(apiClaimBody())],
      admin: [await admin.submitClaim(apiClaimBody()), await admin.submitClaim(apiClaimBody())],
    };

    expect(await findMisattributedClaims(submissions)).toEqual([]);
  });

  test('every claim submitted concurrently is stored under the user who submitted it', async () => {
    // Known defect: ClaimsServiceAdapter mutates the bearer token on one shared ApiClient
    // per request, so concurrent requests are sent with another caller's token.
    test.fail(true, 'DEFECT D6: BFF sends concurrent requests with another caller\'s token');

    const submitBatch = (session: BffApiSession) =>
      Promise.all(
        Array.from({ length: CONCURRENT_SUBMISSIONS_PER_USER }, () => session.submitClaim(apiClaimBody()))
      );
    const [claimantSubmissions, adminSubmissions] = await Promise.all([
      submitBatch(claimant),
      submitBatch(admin),
    ]);

    expect(
      await findMisattributedClaims({ claimant: claimantSubmissions, admin: adminSubmissions }),
      'claims not stored under their submitter'
    ).toEqual([]);
  });

  /** Reads each claim back, one at a time, through the session that submitted it. */
  async function findMisattributedClaims(
    submissions: Record<'claimant' | 'admin', SubmitClaimResult[]>
  ): Promise<string[]> {
    const sessions = { claimant, admin };
    const problems: string[] = [];
    for (const who of ['claimant', 'admin'] as const) {
      for (const submission of submissions[who]) {
        if (submission.status !== HTTP_CREATED) {
          problems.push(`${who}: submit returned ${submission.status} ${submission.body.slice(0, 120)}`);
          continue;
        }
        const { claimId } = JSON.parse(submission.body) as { claimId: string };
        const readBack = await sessions[who].getClaim(claimId);
        if (readBack.status() !== HTTP_OK) {
          problems.push(`${who}: own claim ${claimId} returned ${readBack.status()}`);
        }
      }
    }
    return problems;
  }
});

function apiClaimBody(): SubmitClaimBody {
  const { incidentDate, incidentLocation, description, claimAmount } = buildValidClaim();
  return { incidentDate, incidentLocation, description, claimAmount: Number(claimAmount) };
}

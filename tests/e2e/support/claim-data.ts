import claims from '../test-data/claims.json';

/** Width of the short claim ID shown in the My Claims table. */
export const SHORT_CLAIM_ID_LENGTH = 8;

/** Descriptions longer than this are truncated with "..." in the My Claims table. */
export const LIST_DESCRIPTION_MAX_LENGTH = 50;

export type ClaimInput = {
  incidentDate: string;
  incidentLocation: string;
  claimAmount: string;
  description: string;
  expected: (typeof claims)['validClaim']['expected'];
};

/**
 * Builds a valid claim with a unique description so each run can find its own
 * claim even when the claimant already has many claims.
 */
export function buildValidClaim(): ClaimInput {
  const { descriptionPrefix, ...claim } = claims.validClaim;
  return { ...claim, description: `${descriptionPrefix} #${Date.now()}` };
}

export function shortClaimId(claimId: string): string {
  return claimId.substring(0, SHORT_CLAIM_ID_LENGTH);
}

export function listDescription(description: string): string {
  return description.length <= LIST_DESCRIPTION_MAX_LENGTH
    ? description
    : `${description.substring(0, LIST_DESCRIPTION_MAX_LENGTH)}...`;
}

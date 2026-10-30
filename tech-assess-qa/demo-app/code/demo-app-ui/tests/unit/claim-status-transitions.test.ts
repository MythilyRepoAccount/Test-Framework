import { describe, expect, it } from 'vitest';
import { getValidTransitions } from '@/src/features/admin/utils/claim-status-transitions';
import type { ClaimStatus } from '@/src/lib/api/bff-client';

/**
 * The backend's rules, copied literally from claims-service ClaimStatus.canTransitionTo().
 * The UI only offers these options, so any drift means admins are shown transitions the
 * server rejects, or are blocked from ones it allows.
 */
const BACKEND_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'SUBMITTED'],
  APPROVED: ['CLOSED'],
  REJECTED: ['CLOSED'],
  CLOSED: [],
};

describe('admin claim status transitions', () => {
  it.each(Object.entries(BACKEND_TRANSITIONS))(
    'from %s offers exactly the transitions the backend allows',
    (status, allowed) => {
      expect([...getValidTransitions(status as ClaimStatus)].sort()).toEqual([...allowed].sort());
    }
  );

  it('never offers a transition to the current status', () => {
    for (const status of Object.keys(BACKEND_TRANSITIONS) as ClaimStatus[]) {
      expect(getValidTransitions(status)).not.toContain(status);
    }
  });

  it('treats CLOSED as final', () => {
    expect(getValidTransitions('CLOSED')).toEqual([]);
  });

  it('offers nothing for an unknown status instead of throwing', () => {
    expect(getValidTransitions('ARCHIVED' as ClaimStatus)).toEqual([]);
  });
});

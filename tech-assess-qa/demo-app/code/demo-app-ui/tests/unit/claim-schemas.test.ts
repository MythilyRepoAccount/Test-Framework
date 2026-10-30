import { describe, expect, it } from 'vitest';
import { step1Schema, step2Schema } from '@/src/features/claims/schemas/claim-schemas';

const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 1_000_000;
const MIN_LOCATION_LENGTH = 5;
const MAX_LOCATION_LENGTH = 200;
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const validIncident = {
  incidentDate: new Date('2025-03-14'),
  incidentLocation: '123 Demo Street',
  claimAmount: 1250.5,
};

const firstErrorFor = (input: object) => {
  const result = step1Schema.safeParse({ ...validIncident, ...input });
  return result.success ? undefined : result.error.issues[0].message;
};

describe('incident details (step 1)', () => {
  it('accepts a complete, valid incident', () => {
    expect(step1Schema.safeParse(validIncident).success).toBe(true);
  });

  it.each([
    ['the minimum amount', MIN_AMOUNT],
    ['the maximum amount', MAX_AMOUNT],
  ])('accepts %s', (_, claimAmount) => {
    expect(firstErrorFor({ claimAmount })).toBeUndefined();
  });

  it.each([
    ['zero', 0, 'Claim amount must be at least $0.01'],
    ['a negative amount', -5, 'Claim amount must be at least $0.01'],
    ['one cent over the maximum', MAX_AMOUNT + MIN_AMOUNT, 'Claim amount cannot exceed $1,000,000'],
  ])('rejects %s', (_, claimAmount, message) => {
    expect(firstErrorFor({ claimAmount })).toBe(message);
  });

  it('rejects an empty amount (NaN from an empty number input)', () => {
    expect(firstErrorFor({ claimAmount: Number.NaN })).toBeDefined();
  });

  it.each([
    ['the shortest allowed location', MIN_LOCATION_LENGTH, undefined],
    ['the longest allowed location', MAX_LOCATION_LENGTH, undefined],
    ['a location one character too short', MIN_LOCATION_LENGTH - 1, 'Location must be at least 5 characters'],
    ['a location one character too long', MAX_LOCATION_LENGTH + 1, 'Location cannot exceed 200 characters'],
  ])('validates %s', (_, length, message) => {
    expect(firstErrorFor({ incidentLocation: 'x'.repeat(length) })).toBe(message);
  });

  it('accepts an incident that happened today', () => {
    expect(firstErrorFor({ incidentDate: new Date() })).toBeUndefined();
  });

  it('rejects an incident date in the future', () => {
    expect(firstErrorFor({ incidentDate: new Date(Date.now() + ONE_DAY_MS) })).toBe(
      'Incident date cannot be in the future'
    );
  });
});

describe('supporting details (step 2)', () => {
  it.each([
    ['the shortest allowed description', MIN_DESCRIPTION_LENGTH, true],
    ['the longest allowed description', MAX_DESCRIPTION_LENGTH, true],
    ['a description one character too short', MIN_DESCRIPTION_LENGTH - 1, false],
    ['a description one character too long', MAX_DESCRIPTION_LENGTH + 1, false],
  ])('validates %s', (_, length, isValid) => {
    expect(step2Schema.safeParse({ description: 'x'.repeat(length) }).success).toBe(isValid);
  });
});

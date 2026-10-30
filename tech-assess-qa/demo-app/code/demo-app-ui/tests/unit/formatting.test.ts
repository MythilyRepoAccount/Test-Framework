import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_DESCRIPTION_LENGTH,
  formatCurrency,
  formatDate,
  truncateDescription,
} from '@/src/features/claims/utils/formatting';

describe('formatCurrency', () => {
  it.each([
    [0.01, '$0.01'],
    [1250.5, '$1,250.50'],
    [1_000_000, '$1,000,000.00'],
  ])('formats %d as %s', (amount, expected) => {
    expect(formatCurrency(amount)).toBe(expected);
  });
});

describe('truncateDescription', () => {
  it('leaves a description at the limit untouched', () => {
    const atLimit = 'x'.repeat(MAX_DESCRIPTION_LENGTH);
    expect(truncateDescription(atLimit)).toBe(atLimit);
  });

  it('cuts a description over the limit and adds an ellipsis', () => {
    const overLimit = 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1);
    expect(truncateDescription(overLimit)).toBe(`${'x'.repeat(MAX_DESCRIPTION_LENGTH)}...`);
  });
});

describe('formatDate for a date-only API value ("2025-03-14")', () => {
  // The generated API client turns "2025-03-14" into new Date("2025-03-14"): UTC midnight.
  const apiIncidentDate = () => new Date('2025-03-14');
  const originalTimezone = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTimezone;
  });

  it('shows the same calendar day in UTC', () => {
    process.env.TZ = 'UTC';
    expect(formatDate(apiIncidentDate())).toBe('Mar 14, 2025');
  });

  it('shows the same calendar day east of UTC (Asia/Kolkata)', () => {
    process.env.TZ = 'Asia/Kolkata';
    expect(formatDate(apiIncidentDate())).toBe('Mar 14, 2025');
  });

  // Known defect D1: formatted in local time, so it shows the previous day west of UTC.
  it.fails('shows the same calendar day west of UTC (America/New_York)', () => {
    process.env.TZ = 'America/New_York';
    expect(formatDate(apiIncidentDate())).toBe('Mar 14, 2025');
  });
});

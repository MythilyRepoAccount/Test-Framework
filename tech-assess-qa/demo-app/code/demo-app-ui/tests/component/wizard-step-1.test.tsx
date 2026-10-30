import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { WizardStep1 } from '@/src/features/claims/components/wizard-step-1';
import { useClaimWizardStore } from '@/src/features/claims/stores/use-claim-wizard-store';

const VALID_INCIDENT = { date: '2025-03-14', location: '123 Demo Street', amount: '1250.50' };

const fields = () => ({
  date: screen.getByLabelText(/when did the incident occur/i),
  location: screen.getByLabelText(/where did the incident occur/i),
  amount: screen.getByLabelText(/claim amount/i),
  next: screen.getByRole('button', { name: 'Next' }),
});

async function fillIncident(incident: Partial<typeof VALID_INCIDENT>) {
  const user = userEvent.setup();
  const { date, location, amount } = fields();
  if (incident.date) await user.type(date, incident.date);
  if (incident.location) await user.type(location, incident.location);
  if (incident.amount) await user.type(amount, incident.amount);
  return user;
}

describe('claim wizard, step 1: incident details', () => {
  beforeEach(() => {
    useClaimWizardStore.getState().resetWizard();
  });

  it('keeps Next disabled until every field is valid', async () => {
    render(<WizardStep1 />);
    expect(fields().next).toBeDisabled();

    await fillIncident({ date: VALID_INCIDENT.date, location: VALID_INCIDENT.location });
    expect(fields().next).toBeDisabled();

    await fillIncident({ amount: VALID_INCIDENT.amount });
    expect(fields().next).toBeEnabled();
  });

  it('explains why an amount over the maximum is rejected', async () => {
    render(<WizardStep1 />);
    await fillIncident({ ...VALID_INCIDENT, amount: '1000000.01' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Claim amount cannot exceed $1,000,000');
    expect(fields().next).toBeDisabled();
  });

  it('moves to step 2 with the entered details saved', async () => {
    render(<WizardStep1 />);
    const user = await fillIncident(VALID_INCIDENT);
    await user.click(fields().next);

    const { step, formData } = useClaimWizardStore.getState();
    expect(step).toBe(2);
    expect(formData).toMatchObject({ incidentLocation: VALID_INCIDENT.location, claimAmount: 1250.5 });
    expect(formData.incidentDate?.toISOString().slice(0, 10)).toBe(VALID_INCIDENT.date);
  });

  describe('when the claimant comes Back from step 2', () => {
    beforeEach(() => {
      useClaimWizardStore.setState({
        formData: {
          incidentDate: new Date(VALID_INCIDENT.date),
          incidentLocation: VALID_INCIDENT.location,
          claimAmount: 1250.5,
        },
      });
    });

    it('shows the location and amount entered earlier', () => {
      render(<WizardStep1 />);
      expect(fields().location).toHaveValue(VALID_INCIDENT.location);
      expect(fields().amount).toHaveValue(1250.5);
    });

    // Known defect D4: the stored Date object is passed to <input type="date">, which needs "YYYY-MM-DD".
    it.fails('shows the incident date entered earlier', () => {
      render(<WizardStep1 />);
      expect(fields().date).toHaveValue(VALID_INCIDENT.date);
    });
  });
});

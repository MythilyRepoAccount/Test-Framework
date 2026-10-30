import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { WizardStep2 } from '@/src/features/claims/components/wizard-step-2';
import { useClaimWizardStore } from '@/src/features/claims/stores/use-claim-wizard-store';

const SUPPORTING_DETAILS_STEP = 2;
const VALID_DESCRIPTION = 'Rear bumper damaged while parked';

const description = () => screen.getByLabelText(/describe what happened/i);
const button = (name: 'Next' | 'Back') => screen.getByRole('button', { name });

describe('claim wizard, step 2: supporting details', () => {
  beforeEach(() => {
    useClaimWizardStore.getState().resetWizard();
    useClaimWizardStore.setState({ step: SUPPORTING_DETAILS_STEP });
  });

  it('keeps Next disabled and explains why while the description is too short', async () => {
    render(<WizardStep2 />);
    await userEvent.setup().type(description(), 'Too short');

    expect(await screen.findByRole('alert')).toHaveTextContent('Description must be at least 10 characters');
    expect(button('Next')).toBeDisabled();
  });

  it('counts characters as the claimant types', async () => {
    render(<WizardStep2 />);
    await userEvent.setup().type(description(), VALID_DESCRIPTION);

    expect(screen.getByText(`${VALID_DESCRIPTION.length}/1000`)).toBeInTheDocument();
  });

  it('goes to the review step with the description saved', async () => {
    render(<WizardStep2 />);
    const user = userEvent.setup();
    await user.type(description(), VALID_DESCRIPTION);
    await user.click(button('Next'));

    expect(useClaimWizardStore.getState()).toMatchObject({
      step: SUPPORTING_DETAILS_STEP + 1,
      formData: { description: VALID_DESCRIPTION },
    });
  });

  it('goes back to step 1 without validating the description', async () => {
    render(<WizardStep2 />);
    await userEvent.setup().click(button('Back'));

    expect(useClaimWizardStore.getState().step).toBe(SUPPORTING_DETAILS_STEP - 1);
  });
});

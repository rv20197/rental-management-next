import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Mock RTK Query API hooks used by the rentals page so the component can be
// rendered in isolation without a real Redux store/network layer.
const createRentalMock = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve({ id: 1 }) });

vi.mock('@/api/rentalApi', () => ({
  useGetRentalsQuery: () => ({ data: [], isLoading: false, isFetching: false }),
  useCreateRentalMutation: () => [createRentalMock, { isLoading: false }],
  useUpdateRentalMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteRentalMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/api/billingApi', () => ({
  useReturnAndBillMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/api/itemApi', () => ({
  useGetItemsQuery: () => ({
    data: [{ id: 1, name: 'Scaffolding Pipe', monthlyRate: 100, quantity: 10 }],
  }),
}));

vi.mock('@/api/customerApi', () => ({
  useGetCustomersQuery: () => ({
    data: [{ id: 1, firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', address: '' }],
  }),
}));

vi.mock('sonner', () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import RentalsPage from './page';

function openCreateDialogWithOneItem() {
  render(<RentalsPage />);

  fireEvent.click(screen.getByRole('button', { name: /new rental/i }));

  const dialog = screen.getByRole('dialog', { name: /create new rental/i });

  // Select a customer and an item so the auto-calculated deposit becomes non-zero.
  // The item row's <select> has no htmlFor-linked label, so target it by role
  // order instead: [0] = customer select, [1] = item select.
  const comboBoxes = within(dialog).getAllByRole('combobox');
  fireEvent.change(comboBoxes[0], { target: { value: '1' } });
  fireEvent.change(comboBoxes[1], { target: { value: '1' } });

  return dialog;
}

describe('Create New Rental - deposit field', () => {
  it('renders the deposit input as enabled and editable', () => {
    const dialog = openCreateDialogWithOneItem();

    const depositInput = within(dialog).getByLabelText(/deposit/i) as HTMLInputElement;

    expect(depositInput).toBeEnabled();
    expect(depositInput).not.toHaveAttribute('readonly');
  });

  it('allows the user to type a custom deposit value that is not overwritten by auto-calculation', () => {
    const dialog = openCreateDialogWithOneItem();

    const depositInput = within(dialog).getByLabelText(/deposit/i) as HTMLInputElement;

    // Auto-calculated deposit should be pre-filled once an item is selected.
    expect(depositInput.value).not.toBe('');

    fireEvent.change(depositInput, { target: { value: '999' } });
    expect(depositInput.value).toBe('999');

    // Re-fire a change on the item row (e.g. quantity tweak) to make sure the
    // auto-calculation effect no longer clobbers the manually entered value.
    const quantityInput = within(dialog).getAllByRole('spinbutton')[0];
    fireEvent.change(quantityInput, { target: { value: '2' } });

    expect(depositInput.value).toBe('999');
  });

  it('updates the Total Security Deposit summary immediately as the user types', () => {
    const dialog = openCreateDialogWithOneItem();

    const depositInput = within(dialog).getByLabelText(/deposit/i) as HTMLInputElement;

    const summaryRow = within(dialog).getByText('Total Security Deposit').closest('div');
    expect(summaryRow).not.toBeNull();

    fireEvent.change(depositInput, { target: { value: '1234' } });

    expect(within(summaryRow as HTMLElement).getByText('₹1234.00')).toBeInTheDocument();
  });

  it('does not reset the field when the user clears it or types a non-positive value mid-edit', () => {
    // Regression test: previously, the "overridden" flag was only set when the
    // typed value was a positive number, so clearing the input (or typing 0)
    // caused the auto-calculation effect to instantly overwrite whatever the
    // user was typing, making the field feel locked/read-only.
    const dialog = openCreateDialogWithOneItem();

    const depositInput = within(dialog).getByLabelText(/deposit/i) as HTMLInputElement;

    fireEvent.change(depositInput, { target: { value: '' } });
    expect(depositInput.value).toBe('');

    fireEvent.change(depositInput, { target: { value: '0' } });
    expect(depositInput.value).toBe('0');

    // Trigger the auto-calc effect's dependency (item quantity) again; the
    // manually cleared/zeroed value must remain untouched.
    const quantityInput = within(dialog).getAllByRole('spinbutton')[0];
    fireEvent.change(quantityInput, { target: { value: '3' } });

    expect(depositInput.value).toBe('0');
  });

  it('keeps the Total Security Deposit summary in sync while clearing and retyping the deposit', () => {
    // Reproduces the reported symptom directly: a user backspacing the field
    // before typing a new value used to snap the summary back to the
    // auto-calculated amount instead of tracking the keystroke-by-keystroke input.
    const dialog = openCreateDialogWithOneItem();

    const depositInput = within(dialog).getByLabelText(/deposit/i) as HTMLInputElement;
    const summaryRow = within(dialog).getByText('Total Security Deposit').closest('div') as HTMLElement;

    fireEvent.change(depositInput, { target: { value: '' } });
    fireEvent.change(depositInput, { target: { value: '5' } });
    fireEvent.change(depositInput, { target: { value: '50' } });
    fireEvent.change(depositInput, { target: { value: '500' } });

    expect(depositInput.value).toBe('500');
    expect(within(summaryRow).getByText('₹500.00')).toBeInTheDocument();
  });

  it('submits the manually entered deposit value instead of the auto-calculated one', () => {
    const dialog = openCreateDialogWithOneItem();

    const depositInput = within(dialog).getByLabelText(/deposit/i) as HTMLInputElement;
    fireEvent.change(depositInput, { target: { value: '750' } });

    fireEvent.click(within(dialog).getByRole('button', { name: /^create rental$/i }));

    expect(createRentalMock).toHaveBeenCalledWith(
      expect.objectContaining({ depositAmount: 750 }),
    );
  });
});

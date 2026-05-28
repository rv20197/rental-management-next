export const calculateDefaultDeposit = (monthlyRate: number, quantity: number): number => {
  return (monthlyRate || 0) * 2 * (quantity || 0);
};

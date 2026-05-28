// Client-side preview computation used by the rentals dialog. Simpler than
// the server's authoritative rule in lib/billing/months.ts — it's only for
// quick "what-if" totals before the user submits.
export const calculateMonthsRented = (startDate: Date, returnDate: Date): number => {
  if (returnDate < startDate) return 0;
  const diffTime = returnDate.getTime() - startDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const months = diffDays / 30;
  return Math.max(0, Math.round(months * 10) / 10);
};

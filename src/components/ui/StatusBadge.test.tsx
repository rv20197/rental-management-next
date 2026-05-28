import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders the status text verbatim', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('applies green styling for paid', () => {
    render(<StatusBadge status="paid" />);
    expect(screen.getByText('paid').className).toContain('bg-green-100');
  });

  it('applies red styling for overdue', () => {
    render(<StatusBadge status="overdue" />);
    expect(screen.getByText('overdue').className).toContain('bg-red-100');
  });

  it('falls back to gray for unknown statuses', () => {
    render(<StatusBadge status="weirdvalue" />);
    expect(screen.getByText('weirdvalue').className).toContain('bg-gray-100');
  });
});

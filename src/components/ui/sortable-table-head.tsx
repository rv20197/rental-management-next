'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from './table';

type SortDirection = 'asc' | 'desc';

interface SortableTableHeadProps {
  label: string;
  isActive: boolean;
  direction: SortDirection;
  onClick: () => void;
  className?: string;
}

export function SortableTableHead({ label, isActive, direction, onClick, className }: SortableTableHeadProps) {
  const Icon = !isActive ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-left font-medium text-inherit transition-colors hover:text-foreground"
      >
        <span>{label}</span>
        <Icon className="size-3.5" />
      </button>
    </TableHead>
  );
}

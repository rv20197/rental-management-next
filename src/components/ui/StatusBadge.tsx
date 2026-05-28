import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = React.memo(({ status }: StatusBadgeProps) => {
  const styles: Record<string, string> = {
    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    returned: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    created: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  };

  const style = styles[status.toLowerCase()] || 'bg-gray-100 text-gray-800';

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', style)}>
      {status}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

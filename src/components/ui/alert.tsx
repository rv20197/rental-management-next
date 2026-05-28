import * as React from 'react';

import { cn } from '@/lib/utils';

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'info' | 'success' | 'warning' | 'error';
};

type AlertVariant = NonNullable<AlertProps['variant']>;

const variantClasses: Record<AlertVariant, string> = {
  info: 'bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  success: 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200',
  warning: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  error: 'bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function Alert({ className, variant = 'info', children, ...props }: AlertProps) {
  return (
    <div role="alert" className={cn('rounded-md p-4 border', variantClasses[variant], className)} {...props}>
      {children}
    </div>
  );
}

export { Alert };

import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Themed native select atom. Pure presentational — no Clerk/composition
 * imports (shared-ui boundary only allows shared-lib). Options are passed
 * as children by the caller.
 */
export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

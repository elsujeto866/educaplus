import type { InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Themed radio-button atom. Pure presentational — no Clerk/composition
 * imports (shared-ui boundary only allows shared-lib per eslint.config.mjs).
 * Extracts the `accent-primary` inline radio styling already used ad hoc
 * in the quiz builder's `quiz-option-row.tsx` into a reusable atom for the
 * student-facing quiz runner.
 */
export function Radio({ className, ...props }: RadioProps) {
  return (
    <input
      type="radio"
      className={cn(
        'h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

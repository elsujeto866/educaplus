import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}

/**
 * Label + control slot + error text. Pure presentational — no
 * Clerk/composition imports (shared-ui boundary only allows shared-lib).
 * The caller renders the actual control (Input/Textarea/Select) as
 * `children`, wired to `htmlFor` via matching `id`.
 */
export function FormField({ label, htmlFor, error, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

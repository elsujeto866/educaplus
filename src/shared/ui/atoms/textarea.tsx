import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Themed multiline text input atom. Pure presentational — no
 * Clerk/composition imports (shared-ui boundary only allows shared-lib).
 */
export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

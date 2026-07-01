import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * Themed surface card — cyberpunk dark background, subtle border.
 * Pure presentational atom: no Clerk or framework-specific imports
 * (shared-ui boundary only allows shared-lib per eslint.config.mjs).
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface p-6 shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

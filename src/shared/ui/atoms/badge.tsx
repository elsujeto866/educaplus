import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'border-border bg-surface-elevated text-foreground',
        success: 'border-primary/30 bg-primary/15 text-primary',
        accent: 'border-accent/30 bg-accent/15 text-accent',
        danger: 'border-destructive/30 bg-destructive/15 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Small themed status/role label. Pure presentational atom — no
 * Clerk/composition imports (shared-ui boundary only allows shared-lib
 * per eslint.config.mjs).
 */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

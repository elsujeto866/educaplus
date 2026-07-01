import type { ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'border border-border bg-surface-elevated text-foreground hover:bg-surface',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        ghost: 'text-foreground hover:bg-surface-elevated',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

/**
 * Themed button atom — cyberpunk variants via CVA. Pure presentational:
 * no Clerk/composition imports (shared-ui boundary only allows shared-lib
 * per eslint.config.mjs).
 */
export function Button({ className, variant, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />
  );
}

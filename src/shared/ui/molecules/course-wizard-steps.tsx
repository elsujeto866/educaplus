import Link from 'next/link';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export type WizardStepStatusView = 'completed' | 'current' | 'locked' | 'upcoming';

export interface WizardStepView {
  id: string;
  label: string;
  status: WizardStepStatusView;
  href?: string;
}

export interface CourseWizardStepsProps {
  steps: WizardStepView[];
  className?: string;
}

const STATUS_CLASSES: Record<WizardStepStatusView, string> = {
  completed: 'text-primary',
  current: 'border border-primary bg-surface-elevated text-primary',
  locked: 'text-muted-foreground',
  upcoming: 'text-muted-foreground',
};

/**
 * Pure presentational wizard stepper — no hooks, no data fetching,
 * server-renderable. Status→theme-token classes only (no hardcoded colors),
 * mirroring the sibling `CourseOutlineSidebar` active-node tokens. shared-ui
 * boundary only allows shared-ui/shared-lib imports (eslint.config.mjs) —
 * imports only `next/link`, `lucide-react`, `@/shared/lib/cn`.
 */
export function CourseWizardSteps({ steps, className }: CourseWizardStepsProps) {
  return (
    <ol className={cn('flex flex-col gap-1 text-sm', className)}>
      {steps.map((step) => {
        const locked = step.status === 'locked';
        const actionable =
          !!step.href && (step.status === 'completed' || step.status === 'current');

        const itemClasses = cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
          STATUS_CLASSES[step.status],
          actionable && 'hover:bg-surface-elevated',
        );

        const content = (
          <>
            {step.status === 'completed' ? (
              <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
            ) : step.status === 'locked' ? (
              <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />
            ) : (
              <span aria-hidden="true" className="h-4 w-4 shrink-0" />
            )}
            <span>{step.label}</span>
          </>
        );

        return (
          <li key={step.id} aria-current={step.status === 'current' ? 'step' : undefined}>
            {actionable && step.href ? (
              <Link href={step.href} className={itemClasses}>
                {content}
              </Link>
            ) : (
              <span
                className={itemClasses}
                aria-disabled={locked ? 'true' : undefined}
              >
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

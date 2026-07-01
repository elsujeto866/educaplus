import type { ReactNode } from 'react';
import { Card } from '@/shared/ui/atoms/card';
import { Badge, type BadgeProps } from '@/shared/ui/atoms/badge';
import { ProgressBar } from '@/shared/ui/molecules/progress-bar';
import { cn } from '@/shared/lib/cn';

interface CourseCardStatus {
  label: string;
  variant?: BadgeProps['variant'];
}

interface CourseCardProps {
  title: string;
  description?: string;
  status?: CourseCardStatus;
  /** 0-100. Omit to hide the progress bar entirely (e.g. catalog cards). */
  progressPercent?: number;
  /** Action slot: buttons/links (e.g. "Continuar", "Inscribirme"). */
  children?: ReactNode;
  className?: string;
}

/**
 * Presentational course card. Pure — no data fetching, no
 * Clerk/composition imports (shared-ui boundary only allows shared-ui/
 * shared-lib per eslint.config.mjs). Composes Card + Badge + ProgressBar.
 */
export function CourseCard({
  title,
  description,
  status,
  progressPercent,
  children,
  className,
}: CourseCardProps) {
  return (
    <Card className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {typeof progressPercent === 'number' ? (
        <ProgressBar value={progressPercent} label="Progreso" />
      ) : null}
      {children ? <div className="flex items-center gap-3 pt-1">{children}</div> : null}
    </Card>
  );
}

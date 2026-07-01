import { cn } from '@/shared/lib/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

/**
 * Presentational title/subtitle block. Mobile-first: comfortable text
 * sizes at 375px, no fixed widths that would force horizontal scroll.
 */
export function PageHeader({ title, subtitle, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2 text-center', className)}>
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

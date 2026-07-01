import { cn } from '@/shared/lib/cn';

interface ProgressBarProps {
  /** Percent complete. Values outside 0-100 are clamped. */
  value: number;
  label?: string;
  className?: string;
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Themed (cyberpunk neon) progress bar. Pure presentational molecule — no
 * Clerk/composition imports (shared-ui boundary only allows shared-lib
 * per eslint.config.mjs). Accessible via `role="progressbar"` and
 * `aria-valuenow`/`aria-valuemin`/`aria-valuemax`.
 */
export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const clamped = clampPercent(value);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? <span className="text-xs font-medium text-muted-foreground">{label}</span> : null}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progreso'}
        className="h-2 w-full overflow-hidden rounded-full border border-border bg-surface-elevated"
      >
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)] transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

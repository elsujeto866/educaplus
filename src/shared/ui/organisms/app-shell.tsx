import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface AppShellProps {
  children: ReactNode;
  /**
   * Rendered next to the logo, left of `userSlot`. Kept as a slot (instead
   * of an owned nav component) because role-gated links (e.g. "Cursos",
   * hidden for `student`) are a delivery-layer concern — the caller
   * decides what to render and whether to render it at all.
   */
  navSlot?: ReactNode;
  /**
   * Rendered on the right side of the header. Kept as a slot (instead of
   * an owned component) because Clerk-bound UI (e.g. `<UserButton/>`) may
   * not be imported here — shared-ui only allows shared-lib per
   * eslint.config.mjs. The caller (delivery layer) passes it in.
   */
  userSlot?: ReactNode;
  className?: string;
}

/**
 * Presentational app shell — sticky header + main content area.
 * Mobile-first: header stacks horizontally with a compact height at
 * 375px; content area gets safe horizontal padding.
 */
export function AppShell({ children, navSlot, userSlot, className }: AppShellProps) {
  return (
    <div className={cn('min-h-screen flex flex-col bg-background', className)}>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold text-primary">educaplus</span>
          {navSlot}
        </div>
        {userSlot}
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

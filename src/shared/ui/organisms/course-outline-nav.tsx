'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { CourseOutlineSidebar, type CourseOutline } from './course-outline-sidebar';

interface CourseOutlineNavProps {
  outline: CourseOutline;
  /** Used only when `usePathname()` returns `null` (e.g. outside the App
   *  Router, such as in an isolated test render). */
  fallbackActiveHref?: string | null;
  className?: string;
}

/**
 * Thin `'use client'` shell around the pure `CourseOutlineSidebar` tree.
 * Owns every reactive concern of the course outline — md+ collapse, mobile
 * drawer open/close, and the active route via `usePathname()` — so the
 * tree itself stays hook-free and server-renderable. Rendered by the caller
 * through `AppShell`'s optional `sidebar` slot.
 */
export function CourseOutlineNav({ outline, fallbackActiveHref, className }: CourseOutlineNavProps) {
  const pathname = usePathname();
  const activeHref = pathname ?? fallbackActiveHref ?? null;

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  return (
    <div className={cn('contents', className)}>
      <div className="flex items-center px-4 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir índice del curso"
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-surface-elevated"
        >
          <Menu aria-hidden="true" className="h-4 w-4" />
          <span aria-hidden="true">Índice del curso</span>
        </button>
      </div>

      {drawerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Índice del curso"
          className="fixed inset-0 z-20 flex md:hidden"
        >
          <div aria-hidden="true" className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 flex h-full w-64 flex-col gap-4 border-r border-border bg-surface p-4">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar índice del curso"
              className="self-end rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
            <CourseOutlineSidebar outline={outline} activeHref={activeHref} />
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'hidden flex-col gap-4 p-4 transition-[width] md:flex',
          collapsed ? 'w-14' : 'w-64',
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expandir índice del curso' : 'Contraer índice del curso'}
          className="self-end rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
        <CourseOutlineSidebar outline={outline} activeHref={activeHref} collapsed={collapsed} />
      </div>
    </div>
  );
}

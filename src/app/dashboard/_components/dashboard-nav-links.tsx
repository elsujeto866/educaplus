'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { getActiveHref } from './nav-active-match';

export interface NavItem {
  href: string;
  label: string;
}

interface DashboardNavLinksProps {
  items: NavItem[];
}

/**
 * Client nav renderer. Owns no role logic (the server `DashboardNav` decides
 * which items to pass); its only job is to mark the item for the current
 * route active. It resolves the single active href across ALL items via
 * `getActiveHref` (longest-match-wins) so nested routes never light up two
 * items at once. Active items use the neon-green `primary` token; inactive
 * ones stay muted and turn green on hover.
 */
export function DashboardNavLinks({ items }: DashboardNavLinksProps) {
  const pathname = usePathname();
  const activeHref = getActiveHref(
    pathname,
    items.map((item) => item.href),
  );

  return (
    <>
      {items.map((item) => {
        const isActive = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'text-sm transition-colors',
              isActive
                ? 'font-semibold text-primary'
                : 'font-medium text-foreground hover:text-primary',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

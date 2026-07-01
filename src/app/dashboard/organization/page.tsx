'use client';

import { OrganizationProfile } from '@clerk/nextjs';
import { clerkAppearance } from '@/app/clerk-appearance';

/**
 * Minimal invite host — mounts Clerk's <OrganizationProfile/> (Members tab
 * covers invites) as the page's only content. No path-based sub-routing is
 * configured; Clerk falls back to its own internal (hash-based) navigation
 * for sub-pages, which is sufficient for this minimal invite flow.
 */
export default function OrganizationPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <OrganizationProfile appearance={clerkAppearance} />
    </main>
  );
}

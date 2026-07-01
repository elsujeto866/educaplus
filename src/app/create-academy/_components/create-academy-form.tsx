'use client';

import { CreateOrganization } from '@clerk/nextjs';
import { clerkAppearance } from '@/app/clerk-appearance';

/**
 * Thin client wrapper around Clerk's <CreateOrganization/>. Kept in the
 * delivery layer (src/app) because shared-ui may not import Clerk-bound
 * components (eslint boundaries: shared-ui → shared-lib only).
 */
export function CreateAcademyForm() {
  return (
    <CreateOrganization
      afterCreateOrganizationUrl="/dashboard"
      appearance={clerkAppearance}
    />
  );
}

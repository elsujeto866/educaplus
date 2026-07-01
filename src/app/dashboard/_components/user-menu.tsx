'use client';

import { UserButton } from '@clerk/nextjs';

/**
 * Thin client wrapper around Clerk's <UserButton/>. Kept in the delivery
 * layer (src/app) because shared-ui may not import Clerk-bound components
 * (eslint boundaries: shared-ui → shared-lib only). Passed into AppShell's
 * `userSlot` prop from the dashboard page.
 *
 * No `afterSignOutUrl` prop — that option does not exist on `UserButtonProps`
 * in @clerk/react v6 (verified against node_modules types). Post-sign-out
 * redirect is unauthenticated middleware's job (already covered).
 */
export function UserMenu() {
  return <UserButton />;
}

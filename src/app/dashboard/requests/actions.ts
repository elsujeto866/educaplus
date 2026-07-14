'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeAcademyComposition } from '@/modules/academy/composition';

/**
 * Fire-and-forget approve/reject actions, bound to `<form action={...}>`
 * without `useActionState` — mirrors `dashboard/courses/actions.ts`'
 * publish/unpublish/delete pattern. The page-level `requireInstructor`
 * gate already restricts who reaches these forms; errors (e.g. approving an
 * already-resolved request) propagate to Next's error boundary instead of a
 * Spanish inline message. Both use-cases enforce the admin/instructor role
 * guard again internally (assertRole) — defense in depth, not the only gate.
 */
export async function approveJoinRequestAction(id: string, _formData: FormData): Promise<void> {
  const ctx = await getTenantContext();
  await makeAcademyComposition().approveJoinRequest.execute(ctx, { id });
  revalidatePath('/dashboard/requests');
}

export async function rejectJoinRequestAction(id: string, _formData: FormData): Promise<void> {
  const ctx = await getTenantContext();
  await makeAcademyComposition().rejectJoinRequest.execute(ctx, { id });
  revalidatePath('/dashboard/requests');
}

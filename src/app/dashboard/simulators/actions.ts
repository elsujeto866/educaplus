'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { toActionError, firstZodMessage, type ActionResult } from './_lib/action-result';

/**
 * Canonical Server Action pattern (mirrors `courses/actions.ts`):
 *   1. Zod safeParse(input) → return early on validation failure
 *   2. getTenantContext()   → OUTSIDE any try/catch
 *   3. composition.<uc>.execute(ctx, input) → INSIDE try/catch, mapped via
 *      toActionError() on failure
 *   4. revalidatePath(...) → redirect(...) OUTSIDE the try/catch
 */

const createBankSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'El título debe tener al menos 3 caracteres.')
    .max(200, 'El título es demasiado largo.'),
  description: z
    .string()
    .trim()
    .max(2000, 'La descripción es demasiado larga.')
    .optional(),
});

export async function createBankAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rawDescription = formData.get('description');

  const parsed = createBankSchema.safeParse({
    title: (formData.get('title') ?? '').toString(),
    description: rawDescription ? rawDescription.toString() : undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const ctx = await getTenantContext();

  let bank;
  try {
    bank = await makeSimulatorComposition().createBank.execute(ctx, {
      id: crypto.randomUUID(),
      academyId: ctx.orgId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/simulators');
  redirect(`/dashboard/simulators/banks/${bank.id}`);
}

const updateBankSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'El título debe tener al menos 3 caracteres.')
    .max(200, 'El título es demasiado largo.'),
  description: z
    .string()
    .trim()
    .max(2000, 'La descripción es demasiado larga.')
    .optional(),
});

/** Edits title/description. Stays on the detail page on success (no redirect). */
export async function updateBankAction(
  bankId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rawDescription = formData.get('description');

  const parsed = updateBankSchema.safeParse({
    title: (formData.get('title') ?? '').toString(),
    description: rawDescription ? rawDescription.toString() : undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const ctx = await getTenantContext();

  try {
    await makeSimulatorComposition().updateBank.execute(ctx, {
      id: bankId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/simulators/banks/${bankId}`);
  return { ok: true };
}

/**
 * Delete-with-confirmation. Uses `useActionState` (unlike course's
 * fire-and-forget `deleteCourseAction`) because bank deletion has a real,
 * user-facing rejection path (spec.md "Delete bank referenced by a
 * simulator") that must surface an inline Spanish message instead of
 * falling through to Next's generic error boundary.
 */
export async function deleteBankAction(
  bankId: string,
  _prevState: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const ctx = await getTenantContext();

  try {
    await makeSimulatorComposition().deleteBank.execute(ctx, { id: bankId });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/simulators');
  redirect('/dashboard/simulators');
}

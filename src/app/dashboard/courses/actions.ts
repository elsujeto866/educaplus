'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { toActionError, firstZodMessage, type ActionResult } from './_lib/action-result';

/**
 * CANONICAL Server Action pattern for course authoring (design.md §2).
 * Every mutation in this module — and the ones added in later slices —
 * follows this exact shape:
 *
 *   1. Zod safeParse(input) → return early on validation failure
 *   2. getTenantContext()   → OUTSIDE any try/catch (its own throw is a
 *      legitimate unhandled rejection: "reject before calling any use-case")
 *   3. composition.<uc>.execute(ctx, input) → INSIDE try/catch, mapped via
 *      toActionError() on failure
 *   4. revalidatePath(...) → redirect(...) OUTSIDE the try/catch, since
 *      redirect() throws a Next.js control-flow error by design and must
 *      never be caught by our own error mapping.
 */

const createCourseSchema = z.object({
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

export async function createCourseAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rawDescription = formData.get('description');

  const parsed = createCourseSchema.safeParse({
    title: (formData.get('title') ?? '').toString(),
    description: rawDescription ? rawDescription.toString() : undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const ctx = await getTenantContext();

  try {
    await makeCourseComposition().createCourse.execute(ctx, {
      id: crypto.randomUUID(),
      academyId: ctx.orgId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    });
  } catch (error) {
    return toActionError(error);
  }

  // NOTE (slice 2 → slice 3 handoff): the course detail page
  // (`dashboard/courses/[courseId]`) is not built yet, so we redirect to
  // the list instead of the new course's detail route. Revisit once
  // slice 3 lands.
  revalidatePath('/dashboard/courses');
  redirect('/dashboard/courses');
}

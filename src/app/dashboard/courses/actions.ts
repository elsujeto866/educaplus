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

  let course;
  try {
    course = await makeCourseComposition().createCourse.execute(ctx, {
      id: crypto.randomUUID(),
      academyId: ctx.orgId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/courses');
  redirect(`/dashboard/courses/${course.id}`);
}

// ---------------------------------------------------------------------------
// Course detail (slice 3): edit, publish/unpublish, delete, module management
// ---------------------------------------------------------------------------

const updateCourseSchema = z.object({
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

/**
 * Edits title/description. Stays on the detail page on success — the
 * `useActionState` caller re-renders with `{ ok: true }`, no redirect
 * (design.md §6: "edit title/desc | revalidatePath('/dashboard/courses/{id}')
 * (stay)").
 */
export async function updateCourseAction(
  courseId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rawDescription = formData.get('description');

  const parsed = updateCourseSchema.safeParse({
    title: (formData.get('title') ?? '').toString(),
    description: rawDescription ? rawDescription.toString() : undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const ctx = await getTenantContext();

  try {
    await makeCourseComposition().updateCourse.execute(ctx, {
      id: courseId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/courses/${courseId}`);
  return { ok: true };
}

/**
 * Fire-and-forget status toggles (publish/unpublish/delete) and reorder —
 * bound to `<form action={...}>` without `useActionState`, matching
 * design.md §2's "buttons" skeleton. The page-level `requireInstructor`
 * gate already restricts who reaches these forms; errors propagate to
 * Next's error boundary instead of a Spanish inline message.
 */
export async function publishCourseAction(courseId: string, _formData: FormData): Promise<void> {
  const ctx = await getTenantContext();
  await makeCourseComposition().publishCourse.execute(ctx, { id: courseId });
  revalidatePath(`/dashboard/courses/${courseId}`);
}

export async function unpublishCourseAction(courseId: string, _formData: FormData): Promise<void> {
  const ctx = await getTenantContext();
  await makeCourseComposition().unpublishCourse.execute(ctx, { id: courseId });
  revalidatePath(`/dashboard/courses/${courseId}`);
}

export async function deleteCourseAction(courseId: string, _formData: FormData): Promise<void> {
  const ctx = await getTenantContext();
  await makeCourseComposition().deleteCourse.execute(ctx, { id: courseId });
  revalidatePath('/dashboard/courses');
  redirect('/dashboard/courses');
}

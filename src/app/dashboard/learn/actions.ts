'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { toActionError, type ActionResult } from '../courses/_lib/action-result';

/**
 * Learner-facing Server Actions. Same canonical shape as
 * `dashboard/courses/actions.ts` (design.md §2): Zod → getTenantContext
 * (outside try/catch) → composition.<uc>.execute (inside try/catch, mapped
 * via toActionError) → revalidatePath → redirect (outside try/catch).
 * Reuses `toActionError` from the course-authoring module — delivery→delivery
 * import is allowed by eslint-boundaries (both live under src/app).
 */

const enrollSchema = z.object({
  courseId: z.string().trim().min(1, 'Curso inválido.'),
});

/**
 * Enrolls the caller in a published course. `courseId` is a bound argument
 * (from the catalog page's server-rendered form, not raw FormData) but is
 * still Zod-validated before use. `DuplicateEnrollmentError` and
 * `CourseNotPublishedError` are already mapped to Spanish by `toActionError`.
 */
export async function enrollAction(
  courseId: string,
  _prevState: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const parsed = enrollSchema.safeParse({ courseId });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }

  const ctx = await getTenantContext();

  try {
    await makeCourseComposition().enrollLearner.execute(ctx, {
      id: crypto.randomUUID(),
      courseId: parsed.data.courseId,
      academyId: ctx.orgId,
      clerkUserId: ctx.userId,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/learn/courses');
  redirect(`/dashboard/learn/courses/${parsed.data.courseId}`);
}

const markLessonCompleteSchema = z.object({
  enrollmentId: z.string().trim().min(1, 'Inscripción inválida.'),
  lessonId: z.string().trim().min(1, 'Lección inválida.'),
});

/**
 * Marks a lesson complete for the caller's enrollment. `enrollmentId` is
 * required by `MarkLessonCompleteUseCase` — bound alongside `courseId`/
 * `lessonId` from the lesson viewer page. Idempotent (see spec's "Idempotent
 * re-mark" scenario, enforced by the use-case, not here).
 */
export async function markLessonCompleteAction(
  courseId: string,
  lessonId: string,
  enrollmentId: string,
  _prevState: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const parsed = markLessonCompleteSchema.safeParse({ enrollmentId, lessonId });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }

  const ctx = await getTenantContext();

  try {
    await makeCourseComposition().markLessonComplete.execute(ctx, {
      id: crypto.randomUUID(),
      enrollmentId: parsed.data.enrollmentId,
      lessonId: parsed.data.lessonId,
      academyId: ctx.orgId,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/learn/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/learn/courses/${courseId}`);
  return { ok: true };
}

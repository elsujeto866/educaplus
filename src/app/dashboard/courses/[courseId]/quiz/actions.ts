'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { toActionError, firstZodMessage, type ActionResult } from '../../_lib/action-result';
import { parseQuizPayload } from './_lib/quiz-form';

/**
 * Quiz builder Server Action — follows the canonical pattern (design.md
 * §2 / actions.ts): zod safeParse → getTenantContext() OUTSIDE try →
 * parseQuizPayload + upsertAssessment.execute INSIDE try, mapped via
 * toActionError() on failure → revalidatePath → stay (no redirect).
 */

const saveQuizSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'El título debe tener al menos 3 caracteres.')
    .max(200, 'El título es demasiado largo.'),
  passingScore: z.coerce
    .number()
    .int('El puntaje debe ser un entero entre 0 y 100.')
    .min(0, 'El puntaje debe ser un entero entre 0 y 100.')
    .max(100, 'El puntaje debe ser un entero entre 0 y 100.')
    .default(70),
  payload: z.string(),
});

export async function saveQuizAction(
  courseId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = saveQuizSchema.safeParse({
    title: (formData.get('title') ?? '').toString(),
    passingScore: (formData.get('passingScore') ?? '').toString(),
    payload: (formData.get('payload') ?? '').toString(),
  });

  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const ctx = await getTenantContext();

  try {
    const questions = parseQuizPayload(parsed.data.payload);
    await makeCourseComposition().upsertAssessment.execute(ctx, {
      id: crypto.randomUUID(),
      courseId,
      academyId: ctx.orgId,
      title: parsed.data.title,
      passingScore: parsed.data.passingScore,
      questions,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/courses/${courseId}/quiz`);
  revalidatePath(`/dashboard/courses/${courseId}`);
  return { ok: true };
}

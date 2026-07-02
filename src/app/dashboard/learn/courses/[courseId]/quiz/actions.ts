'use server';

import { z } from 'zod';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { toActionError } from '../../../../courses/_lib/action-result';
import type { QuizAttemptState } from './_lib/quiz-attempt-result';

/**
 * saveAttemptAction — Server Action for the student quiz runner. Mirrors
 * the canonical pattern (design.md §"Server Action design" / the quiz
 * builder's `saveQuizAction`): `getTenantContext()` OUTSIDE the try — an
 * unauthenticated caller should never reach `submitAttempt` — then
 * payload parse + `submitAttempt.execute()` INSIDE the try, mapped via
 * `toActionError()` on failure. No `revalidatePath`/redirect: the runner
 * stays on the same page and renders the result via `useActionState`.
 */

const answersSchema = z
  .array(
    z.object({
      questionId: z.string().min(1),
      selectedOptionId: z.string().min(1),
    }),
  )
  .min(1, 'Debés responder todas las preguntas.');

export async function saveAttemptAction(
  courseId: string,
  _prevState: QuizAttemptState,
  formData: FormData,
): Promise<QuizAttemptState> {
  const ctx = await getTenantContext();

  try {
    const raw: unknown = JSON.parse((formData.get('payload') ?? '').toString());
    const answers = answersSchema.parse(raw);

    const result = await makeCourseComposition().submitAttempt.execute(ctx, {
      id: crypto.randomUUID(),
      courseId,
      answers,
    });

    return { ok: true, score: result.score, passed: result.passed };
  } catch (error) {
    const mapped = toActionError(error);
    return mapped.ok ? { ok: false, error: 'Ocurrió un error. Intentá de nuevo.' } : mapped;
  }
}

'use server';

import { z } from 'zod';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { toActionError } from '../../../../../simulators/_lib/action-result';
import type { SubmitAttemptState } from './_lib/submit-attempt-result';

/**
 * submitAttemptAction — Server Action for the student exam runner. Mirrors
 * course's `saveAttemptAction`: getTenantContext() OUTSIDE the try (an
 * unauthenticated caller should never reach `submitAttempt`), payload
 * parse + `submitAttempt.execute()` INSIDE the try, mapped via
 * `toActionError()` on failure. No redirect — the runner stays on the
 * same page and renders the result via `useActionState`.
 *
 * UNLIKE course's quiz (which requires a FULL bijection of answers), the
 * schema here allows a PARTIAL (or even empty) answers array — Decision 5:
 * "auto-scores what exists", never rejected for being incomplete. The
 * SERVER (SubmitAttemptUseCase) — not this schema — decides whether the
 * submission is on-time or late; the client's elapsed-time display is UX
 * only and never trusted.
 */

const answersSchema = z.array(
  z.object({
    questionId: z.string().min(1),
    selectedOptionId: z.string().min(1),
  }),
);

export async function submitAttemptAction(
  attemptId: string,
  _prevState: SubmitAttemptState,
  formData: FormData,
): Promise<SubmitAttemptState> {
  const ctx = await getTenantContext();

  try {
    const raw: unknown = JSON.parse((formData.get('payload') ?? '[]').toString());
    const answers = answersSchema.parse(raw);

    const result = await makeSimulatorComposition().submitAttempt.execute(ctx, {
      attemptId,
      answers,
    });

    return { ok: true, score: result.score, passed: result.passed, status: result.status };
  } catch (error) {
    const mapped = toActionError(error);
    return mapped.ok ? { ok: false, error: 'Ocurrió un error. Intentá de nuevo.' } : mapped;
  }
}

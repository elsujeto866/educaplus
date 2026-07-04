'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { toActionError, firstZodMessage, type ActionResult } from '../_lib/action-result';

/**
 * Simulator rule-builder Server Actions — edit/publish/unpublish. Follows
 * the canonical pattern (mirrors `banks/[bankId]/simulators/actions.ts`).
 * All three stay on the edit page (no redirect) — `revalidatePath` only.
 */

const updateSimulatorSchema = z.object({
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
  questionCount: z.coerce
    .number()
    .int('La cantidad de preguntas debe ser un número entero.')
    .min(1, 'La cantidad de preguntas debe ser al menos 1.'),
  passingScore: z.coerce
    .number()
    .int('El puntaje de aprobación debe ser un número entero.')
    .min(0, 'El puntaje de aprobación debe estar entre 0 y 100.')
    .max(100, 'El puntaje de aprobación debe estar entre 0 y 100.'),
  timeLimitMinutes: z.coerce
    .number()
    .int('El límite de tiempo debe ser un número entero.')
    .min(1, 'El límite de tiempo debe ser al menos 1 minuto.'),
  attemptLimit: z.coerce
    .number()
    .int('El límite de intentos debe ser un número entero.')
    .min(1, 'El límite de intentos debe ser al menos 1.'),
});

export async function updateSimulatorAction(
  simulatorId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rawDescription = formData.get('description');
  const topics = formData.getAll('topics').map((value) => value.toString());
  const issuesCertificate = formData.has('issuesCertificate');

  const parsed = updateSimulatorSchema.safeParse({
    title: (formData.get('title') ?? '').toString(),
    description: rawDescription ? rawDescription.toString() : undefined,
    questionCount: (formData.get('questionCount') ?? '').toString(),
    passingScore: (formData.get('passingScore') ?? '').toString(),
    timeLimitMinutes: (formData.get('timeLimitMinutes') ?? '').toString(),
    attemptLimit: (formData.get('attemptLimit') ?? '').toString(),
  });

  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const ctx = await getTenantContext();

  try {
    await makeSimulatorComposition().updateSimulator.execute(ctx, {
      id: simulatorId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      questionCount: parsed.data.questionCount,
      passingScore: parsed.data.passingScore,
      timeLimitMinutes: parsed.data.timeLimitMinutes,
      attemptLimit: parsed.data.attemptLimit,
      topicFilter: topics.length > 0 ? topics : null,
      issuesCertificate,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/simulators/${simulatorId}/edit`);
  return { ok: true };
}

/**
 * Uses `useActionState` (unlike course's fire-and-forget publish) because
 * `PublishSimulatorUseCase` has a real, user-facing rejection path
 * (spec.md "Bank has fewer questions than required") that must surface an
 * inline Spanish message instead of falling through to Next's generic
 * error boundary — same rationale as `deleteBankAction` in Slice S2.
 */
export async function publishSimulatorAction(
  simulatorId: string,
  _prevState: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const ctx = await getTenantContext();

  try {
    await makeSimulatorComposition().publishSimulator.execute(ctx, { id: simulatorId });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/simulators/${simulatorId}/edit`);
  return { ok: true };
}

/** Fire-and-forget — unpublish never has a rejection path. Mirrors `unpublishCourseAction`. */
export async function unpublishSimulatorAction(simulatorId: string, _formData: FormData): Promise<void> {
  const ctx = await getTenantContext();
  await makeSimulatorComposition().unpublishSimulator.execute(ctx, { id: simulatorId });
  revalidatePath(`/dashboard/simulators/${simulatorId}/edit`);
}

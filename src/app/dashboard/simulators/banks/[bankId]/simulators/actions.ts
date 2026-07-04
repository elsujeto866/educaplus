'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { toActionError, firstZodMessage, type ActionResult } from '../../../_lib/action-result';

/**
 * Simulator CREATION Server Action — bank-scoped (Decision 1: a simulator
 * always binds to exactly one bank, so creation lives at
 * `banks/[bankId]/simulators/new` rather than a generic bank-picker).
 * Follows the canonical pattern (mirrors `simulators/actions.ts`): zod
 * safeParse → getTenantContext() OUTSIDE try → use-case.execute() INSIDE
 * try, mapped via toActionError() → revalidatePath → redirect (OUTSIDE try).
 */

const createSimulatorSchema = z.object({
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

export async function createSimulatorAction(
  bankId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rawDescription = formData.get('description');
  const topics = formData.getAll('topics').map((value) => value.toString());

  const parsed = createSimulatorSchema.safeParse({
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

  let simulator;
  try {
    simulator = await makeSimulatorComposition().createSimulator.execute(ctx, {
      id: crypto.randomUUID(),
      academyId: ctx.orgId,
      bankId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      questionCount: parsed.data.questionCount,
      passingScore: parsed.data.passingScore,
      timeLimitMinutes: parsed.data.timeLimitMinutes,
      attemptLimit: parsed.data.attemptLimit,
      topicFilter: topics.length > 0 ? topics : null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/simulators');
  redirect(`/dashboard/simulators/${simulator.id}/edit`);
}

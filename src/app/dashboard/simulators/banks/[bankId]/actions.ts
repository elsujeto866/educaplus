'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { toActionError, firstZodMessage, type ActionResult } from '../../_lib/action-result';
import { parseOptionsPayload } from './_lib/question-form';

/**
 * Question authoring Server Actions — follows the canonical pattern
 * (mirrors `courses/actions.ts` / `quiz/actions.ts`): zod safeParse →
 * getTenantContext() OUTSIDE try → parseOptionsPayload + use-case.execute
 * INSIDE try, mapped via toActionError() on failure → revalidatePath →
 * stay (no redirect — the question list lives on the same bank detail
 * page).
 */

const addQuestionSchema = z.object({
  prompt: z.string().trim().min(1, 'El enunciado es obligatorio.').max(2000, 'El enunciado es demasiado largo.'),
  topic: z.string().trim().max(100, 'El tema es demasiado largo.').optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  explanation: z.string().trim().max(2000, 'La explicación es demasiado larga.').optional(),
  optionsPayload: z.string(),
});

export async function addQuestionAction(
  bankId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rawTopic = formData.get('topic');
  const rawDifficulty = formData.get('difficulty');
  const rawExplanation = formData.get('explanation');

  const parsed = addQuestionSchema.safeParse({
    prompt: (formData.get('prompt') ?? '').toString(),
    topic: rawTopic ? rawTopic.toString() : undefined,
    difficulty: rawDifficulty ? rawDifficulty.toString() : undefined,
    explanation: rawExplanation ? rawExplanation.toString() : undefined,
    optionsPayload: (formData.get('optionsPayload') ?? '').toString(),
  });

  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  let options;
  try {
    options = parseOptionsPayload(parsed.data.optionsPayload);
  } catch (error) {
    return toActionError(error);
  }

  const ctx = await getTenantContext();

  try {
    await makeSimulatorComposition().addQuestion.execute(ctx, {
      id: crypto.randomUUID(),
      bankId,
      academyId: ctx.orgId,
      prompt: parsed.data.prompt,
      options: options.options,
      correctOptionId: options.correctOptionId,
      topic: parsed.data.topic ?? null,
      difficulty: parsed.data.difficulty ?? null,
      explanation: parsed.data.explanation ?? null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/simulators/banks/${bankId}`);
  return { ok: true };
}

const updateQuestionSchema = addQuestionSchema;

export async function updateQuestionAction(
  bankId: string,
  questionId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rawTopic = formData.get('topic');
  const rawDifficulty = formData.get('difficulty');
  const rawExplanation = formData.get('explanation');

  const parsed = updateQuestionSchema.safeParse({
    prompt: (formData.get('prompt') ?? '').toString(),
    topic: rawTopic ? rawTopic.toString() : undefined,
    difficulty: rawDifficulty ? rawDifficulty.toString() : undefined,
    explanation: rawExplanation ? rawExplanation.toString() : undefined,
    optionsPayload: (formData.get('optionsPayload') ?? '').toString(),
  });

  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  let options;
  try {
    options = parseOptionsPayload(parsed.data.optionsPayload);
  } catch (error) {
    return toActionError(error);
  }

  const ctx = await getTenantContext();

  try {
    await makeSimulatorComposition().updateQuestion.execute(ctx, {
      id: questionId,
      prompt: parsed.data.prompt,
      options: options.options,
      correctOptionId: options.correctOptionId,
      topic: parsed.data.topic ?? null,
      difficulty: parsed.data.difficulty ?? null,
      explanation: parsed.data.explanation ?? null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/simulators/banks/${bankId}`);
  return { ok: true };
}

/** Fire-and-forget delete, bound to `<form action={...}>` — mirrors `publishCourseAction`. */
export async function deleteQuestionAction(
  bankId: string,
  questionId: string,
  _formData: FormData,
): Promise<void> {
  const ctx = await getTenantContext();
  await makeSimulatorComposition().deleteQuestion.execute(ctx, { id: questionId });
  revalidatePath(`/dashboard/simulators/banks/${bankId}`);
}

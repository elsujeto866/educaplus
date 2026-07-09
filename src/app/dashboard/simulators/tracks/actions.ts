'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { toActionError, firstZodMessage, type ActionResult } from '../_lib/action-result';
import { computeReorderedIds, type ReorderDirection } from './_lib/reorder';

/**
 * Track authoring Server Actions — the canonical pattern (mirrors
 * `simulators/actions.ts` / `simulators/banks/[bankId]/actions.ts`):
 *   1. Zod safeParse(input) → return early on validation failure
 *   2. getTenantContext()   → OUTSIDE any try/catch
 *   3. composition.<uc>.execute(ctx, input) → INSIDE try/catch, mapped via
 *      toActionError() on failure
 *   4. revalidatePath(...) → redirect(...) OUTSIDE the try/catch
 */

const createTrackSchema = z.object({
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

export async function createTrackAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rawDescription = formData.get('description');

  const parsed = createTrackSchema.safeParse({
    title: (formData.get('title') ?? '').toString(),
    description: rawDescription ? rawDescription.toString() : undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const ctx = await getTenantContext();

  let track;
  try {
    track = await makeSimulatorComposition().createTrack.execute(ctx, {
      id: crypto.randomUUID(),
      academyId: ctx.orgId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath('/dashboard/simulators/tracks');
  redirect(`/dashboard/simulators/tracks/${track.id}`);
}

const addTrackStepSchema = z.object({
  simulatorId: z.string().trim().min(1, 'Elegí un simulacro para agregar.'),
});

/**
 * Appends an existing PUBLISHED simulator as the track's next step. Has a
 * real, user-facing rejection path (`SimulatorNotPublishedError`,
 * `SimulatorAlreadyInTrackError`, `TrackStepPositionConflictError`,
 * `SimulatorNotFoundError`) so it uses `useActionState`/`ActionResult`
 * instead of a fire-and-forget void return — same rationale as
 * `addQuestionAction`.
 */
export async function addTrackStepAction(
  trackId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = addTrackStepSchema.safeParse({
    simulatorId: (formData.get('simulatorId') ?? '').toString(),
  });

  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const ctx = await getTenantContext();

  try {
    await makeSimulatorComposition().addSimulatorToTrackStep.execute(ctx, {
      id: crypto.randomUUID(),
      trackId,
      academyId: ctx.orgId,
      simulatorId: parsed.data.simulatorId,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/simulators/tracks/${trackId}`);
  return { ok: true };
}

/**
 * Fire-and-forget delete, bound to `<form action={...}>` — mirrors
 * `deleteQuestionAction`. `RemoveTrackStepUseCase`'s only rejection paths
 * (`SimulatorTrackNotFoundError`/`SimulatorTrackStepNotFoundError`) are
 * defensive-only from this UI (stepId always comes from the rendered
 * track's own step list), so no inline ActionResult surface is needed.
 */
export async function removeTrackStepAction(
  trackId: string,
  stepId: string,
  _formData: FormData,
): Promise<void> {
  const ctx = await getTenantContext();
  await makeSimulatorComposition().removeTrackStep.execute(ctx, { trackId, stepId });
  revalidatePath(`/dashboard/simulators/tracks/${trackId}`);
}

/**
 * Loads the track's current step order, computes the swap via the pure
 * `computeReorderedIds` helper, and persists only when the move is not a
 * no-op — mirrors `courses/actions.ts`'s `reorderModule` helper exactly.
 */
async function reorderTrackStep(trackId: string, stepId: string, direction: ReorderDirection): Promise<void> {
  const ctx = await getTenantContext();
  const composition = makeSimulatorComposition();
  const detail = await composition.getTrackDetail.execute(ctx, trackId);
  if (!detail) {
    revalidatePath(`/dashboard/simulators/tracks/${trackId}`);
    return;
  }

  const orderedIds = detail.steps.map((step: { id: string }) => step.id);
  const reordered = computeReorderedIds(orderedIds, stepId, direction);

  if (reordered !== orderedIds) {
    await composition.reorderTrackSteps.execute(ctx, { trackId, orderedStepIds: reordered });
  }

  revalidatePath(`/dashboard/simulators/tracks/${trackId}`);
}

export async function reorderTrackStepUpAction(
  trackId: string,
  stepId: string,
  _formData: FormData,
): Promise<void> {
  await reorderTrackStep(trackId, stepId, 'up');
}

export async function reorderTrackStepDownAction(
  trackId: string,
  stepId: string,
  _formData: FormData,
): Promise<void> {
  await reorderTrackStep(trackId, stepId, 'down');
}

/**
 * Uses `useActionState` (unlike unpublish below) because `PublishTrackUseCase`
 * has a real, user-facing rejection path — `EmptyTrackError` (a track with
 * zero steps cannot be published) — that must surface an inline Spanish
 * message. Mirrors `publishSimulatorAction`'s rationale exactly.
 */
export async function publishTrackAction(
  trackId: string,
  _prevState: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const ctx = await getTenantContext();

  try {
    await makeSimulatorComposition().publishTrack.execute(ctx, { id: trackId });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/dashboard/simulators/tracks/${trackId}`);
  return { ok: true };
}

/** Fire-and-forget — unpublish never has a rejection path. Mirrors `unpublishSimulatorAction`. */
export async function unpublishTrackAction(trackId: string, _formData: FormData): Promise<void> {
  const ctx = await getTenantContext();
  await makeSimulatorComposition().unpublishTrack.execute(ctx, { id: trackId });
  revalidatePath(`/dashboard/simulators/tracks/${trackId}`);
}

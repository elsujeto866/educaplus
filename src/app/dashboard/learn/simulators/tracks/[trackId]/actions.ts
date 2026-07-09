'use server';

import { redirect } from 'next/navigation';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { toActionError, type ActionResult } from '../../../../simulators/_lib/action-result';

/**
 * startTrackStepAttemptAction — Server Action bound to the level-map's
 * "Comenzar" button for an UNLOCKED step. Mirrors `startAttemptAction`'s
 * shape verbatim, but delegates to `startTrackStepAttempt` (THE guarded
 * composition entry — `StartTrackStepAttemptUseCase`) instead of the raw
 * `startAttempt`, so a locked step can never be started from the track
 * context either (defense-in-depth: the level-map only ever renders this
 * button for an unlocked step, but a stale/replayed form submission — e.g.
 * a second browser tab where the step has since been re-locked, which
 * cannot actually happen since unlocks are monotonic, or simply calling
 * this action directly — still hits the SAME server-side check).
 *
 * Redirects to the EXISTING, unmodified attempt page
 * (`/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]`) — the
 * attempt-taking flow itself is shared/untouched between the standalone and
 * track contexts.
 */
export async function startTrackStepAttemptAction(
  simulatorId: string,
  _prevState: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const ctx = await getTenantContext();

  let attempt;
  try {
    attempt = await makeSimulatorComposition().startTrackStepAttempt.execute(ctx, {
      id: crypto.randomUUID(),
      simulatorId,
    });
  } catch (error) {
    return toActionError(error);
  }

  redirect(`/dashboard/learn/simulators/${simulatorId}/attempt/${attempt.id}`);
}

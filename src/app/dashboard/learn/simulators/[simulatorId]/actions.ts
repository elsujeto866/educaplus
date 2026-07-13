'use server';

import { redirect } from 'next/navigation';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { toActionError, type ActionResult } from '../../../simulators/_lib/action-result';

/**
 * startAttemptAction — Server Action bound to the student detail page's
 * "Comenzar simulador" button. Follows the canonical pattern (mirrors
 * `createSimulatorAction`): getTenantContext() + use-case.execute() INSIDE
 * try, mapped via toActionError() on failure; redirect() OUTSIDE the try
 * (Next's redirect signal must never be swallowed by the catch).
 *
 * Calls `StartTrackStepAttemptUseCase` (NOT the raw `StartAttemptUseCase`)
 * so this ENDPOINT is authoritative on its own, regardless of which UI path
 * reaches it. `StartTrackStepAttemptUseCase` is a transparent pass-through
 * for standalone (non-track) simulators — it delegates straight to the same
 * `StartAttemptUseCase` behavior when the simulator isn't a track step, so
 * this action's behavior for standalone simulators is unchanged. For a
 * track-step simulator it additionally enforces the gamified progression
 * lock BEFORE creating any attempt, throwing `StepLockedError` (mapped
 * below to an inline Spanish message, never a crash) if the step isn't
 * unlocked for this learner yet. Relying on the detail page hiding the
 * button, or on framework bound-arg encryption, is NOT an authorization
 * boundary — this action must reject a locked step on its own.
 *
 * On the abuse path (attempt-limit exhausted), the delegate throws
 * `AttemptLimitReachedError` BEFORE any row is created — this action
 * surfaces it as an inline Spanish message, never a crash, and never
 * redirects. Same treatment applies to `StepLockedError`.
 */
export async function startAttemptAction(
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

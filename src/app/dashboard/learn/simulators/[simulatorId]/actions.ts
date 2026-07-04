'use server';

import { redirect } from 'next/navigation';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { toActionError, type ActionResult } from '../../../simulators/_lib/action-result';

/**
 * startAttemptAction — Server Action bound to the student detail page's
 * "Comenzar simulacro" button. Follows the canonical pattern (mirrors
 * `createSimulatorAction`): getTenantContext() + use-case.execute() INSIDE
 * try, mapped via toActionError() on failure; redirect() OUTSIDE the try
 * (Next's redirect signal must never be swallowed by the catch).
 *
 * On the abuse path (attempt-limit exhausted), `StartAttemptUseCase`
 * throws `AttemptLimitReachedError` BEFORE any row is created — this
 * action surfaces it as an inline Spanish message, never a crash, and
 * never redirects.
 */
export async function startAttemptAction(
  simulatorId: string,
  _prevState: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const ctx = await getTenantContext();

  let attempt;
  try {
    attempt = await makeSimulatorComposition().startAttempt.execute(ctx, {
      id: crypto.randomUUID(),
      simulatorId,
    });
  } catch (error) {
    return toActionError(error);
  }

  redirect(`/dashboard/learn/simulators/${simulatorId}/attempt/${attempt.id}`);
}

/**
 * SubmitAttemptState — the return shape of `submitAttemptAction`, threaded
 * through `useActionState` in the exam runner. Distinct from the shared
 * `ActionResult` (`{ok:true}`) because a successful submission must also
 * carry the `score`/`passed`/`status` the result view renders. `status`
 * is `'submitted'` (on-time) or `'expired'` (late — Decision 5, never
 * rejected but never disguised as on-time either). Mirrors course's
 * `QuizAttemptState`.
 */
export type SubmitAttemptState =
  | { ok: true; score: number; passed: boolean; status: 'submitted' | 'expired' }
  | { ok: false; error: string };

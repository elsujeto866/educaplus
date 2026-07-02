/**
 * QuizAttemptState — the return shape of `saveAttemptAction`, threaded
 * through `useActionState` in `QuizRunner`. Distinct from the shared
 * `ActionResult` (`{ok:true}`) because a successful attempt submission
 * must also carry the `score`/`passed` the result view renders.
 */
export type QuizAttemptState =
  | { ok: true; score: number; passed: boolean }
  | { ok: false; error: string };

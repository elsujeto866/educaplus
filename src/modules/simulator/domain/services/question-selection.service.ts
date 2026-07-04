import type { Question } from '../question.entity';
import type { RandomPort } from '../ports/random.port';

/**
 * Question-selection engine — Decision 7 ("random N" strategy).
 *
 * PURE domain service: zero infrastructure imports, randomness threaded in
 * via `RandomPort` (never `Math.random` — see that port's docstring).
 * Consumed by StartAttemptUseCase (Slice S4) to draw+freeze the question
 * set, and by PublishSimulatorUseCase (this slice) to check the "insufficient
 * bank pool" gate via `filterByTopic` alone.
 *
 * `selectionStrategy` currently only has one value ('random' — see
 * `Simulator.selectionStrategy`), so this file exports a single strategy
 * function rather than a strategy registry; a future 'random_per_topic'/
 * 'fixed' strategy would add a sibling export, not touch this one.
 */

/**
 * Filters a question pool down to those matching `topicFilter`.
 *
 * `null`, `undefined`, or an EMPTY array all mean "no topic filter" — an
 * empty array is treated the same as null rather than "match nothing",
 * since the UI has no way to express "explicitly zero topics selected" as
 * distinct from "no filter applied" (both render as an unchecked checkbox
 * group). Questions with a null topic never match a non-empty filter.
 *
 * Does not mutate the input pool.
 */
export function filterByTopic(
  pool: readonly Question[],
  topicFilter: readonly string[] | null | undefined,
): Question[] {
  if (!topicFilter || topicFilter.length === 0) {
    return [...pool];
  }

  const allowed = new Set(topicFilter);
  return pool.filter((question) => question.topic != null && allowed.has(question.topic));
}

/**
 * Draws `count` questions from `pool`, filtered by `topicFilter` first.
 *
 * If the filtered pool has `count` or fewer questions, ALL of them are
 * returned — no error (Decision 7: "If pool < questionCount -> use all
 * available"). The "insufficient pool" REJECTION is a separate, earlier
 * gate enforced by PublishSimulatorUseCase; this engine stays tolerant so a
 * bank that legitimately shrinks again after publish never crashes an
 * attempt start, it just returns a smaller-than-configured set.
 *
 * When the filtered pool is larger than `count`, a Fisher-Yates shuffle
 * (driven entirely by `rng.next()`) picks exactly `count` distinct
 * questions. Does not mutate the input pool.
 */
export function selectQuestions(
  pool: readonly Question[],
  count: number,
  topicFilter: readonly string[] | null | undefined,
  rng: RandomPort,
): Question[] {
  const filtered = filterByTopic(pool, topicFilter);

  if (filtered.length <= count) {
    return filtered;
  }

  const shuffled = [...filtered];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const swap = shuffled[i];
    shuffled[i] = shuffled[j] as Question;
    shuffled[j] = swap as Question;
  }

  return shuffled.slice(0, count);
}

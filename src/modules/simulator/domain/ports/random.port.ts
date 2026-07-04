/**
 * Port: RandomPort — the ONLY source of randomness the selection engine
 * (`domain/services/question-selection.service.ts`) is allowed to use.
 *
 * The domain layer never calls `Math.random()` directly: (1) it makes the
 * random-N draw untestable/non-deterministic, and (2) `Math.random` is
 * unavailable in some runtimes this app targets. Every call site must
 * inject a `RandomPort` implementation instead — production code wires a
 * crypto-backed adapter (`infrastructure/crypto-random.adapter.ts`); tests
 * inject a fake with a fixed sequence.
 */
export interface RandomPort {
  /** Returns a float in the range [0, 1) — same contract as `Math.random()`. */
  next(): number;
}

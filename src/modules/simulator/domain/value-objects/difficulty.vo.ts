/**
 * Difficulty — question difficulty level within a question bank.
 *
 * Nullable at the schema level (`questions.difficulty`) — an unclassified
 * question is a valid state. `parseDifficulty()` only validates non-null
 * input; callers (e.g. Question entity) decide whether null/undefined is
 * acceptable for their field.
 *
 * Mirrors `modules/course/domain/value-objects/publication-status.vo.ts`:
 * a closed string union validated by a single parse function.
 *
 * Pure TS — zero imports.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

const VALID: ReadonlySet<string> = new Set<Difficulty>(['easy', 'medium', 'hard']);

/**
 * Validates and narrows a raw string to Difficulty.
 * Throws when the value is not a member of the closed set.
 */
export function parseDifficulty(value: string): Difficulty {
  if (!VALID.has(value)) {
    throw new Error(`Invalid difficulty "${value}": must be "easy", "medium", or "hard"`);
  }
  return value as Difficulty;
}

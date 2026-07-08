/**
 * Port: CsvQuestionSource
 *
 * Structurally parses raw CSV text into `ParsedCsvQuestion` rows. Deliberately
 * NOT the `Question` entity itself — `parse()` never throws and never
 * validates business invariants (blank prompt, duplicate option ids,
 * dangling correctOptionId, invalid difficulty, etc). Those invariants are
 * ALL owned by the `Question` constructor (see `domain/question.entity.ts`)
 * and are enforced downstream by `ImportQuestionsFromCsvUseCase`, one row at
 * a time, so a single malformed row never aborts the whole import
 * (spec.md's SKIP-INVALID policy). This mirrors the "adapter returns raw
 * shape, use-case owns validation" split already used by
 * `AddQuestionUseCase` (caller passes raw fields, `new Question` validates).
 *
 * Pure TS — zero imports, zero infrastructure/framework dependencies. The
 * production implementation (`Rfc4180CsvQuestionSource`, under
 * `infrastructure/`) is a pure in-memory string parser: it does not touch
 * disk, network, or a database, so it stays trivially satisfiable under the
 * `boundaries/dependencies` ESLint rule ("infrastructure" is allowed to
 * depend on "domain", but nothing forces it to import anything at all).
 */

/** One column-mapped, structurally-parsed question row. Never partially valid — always ALL fields present, defaulted to '' / null when the source cell was blank. */
export interface ParsedCsvQuestion {
  /** 1-based row number as it appears in the source file, counting the header as row 1 — used to report skip reasons back to the caller. */
  rowNumber: number;
  prompt: string;
  /** Only non-blank option cells are included (blank option columns are dropped, never surfaced as empty-label options). */
  options: Array<{ id: string; label: string }>;
  /** Raw value of the `correct_option` column (lower-cased letter, e.g. "a"..."d"). May reference an id that is not present in `options` — that is a validation concern, not a parsing concern. */
  correctOptionId: string;
  topic: string | null;
  difficulty: string | null;
  explanation: string | null;
}

export interface CsvQuestionSource {
  /**
   * Parses `content` (a full CSV file's text) into one entry per data row
   * (the header row itself is consumed for column mapping and is never
   * included in the result). Returns `[]` for an empty file or a
   * header-only file (no data rows) — never throws.
   */
  parse(content: string): ParsedCsvQuestion[];
}

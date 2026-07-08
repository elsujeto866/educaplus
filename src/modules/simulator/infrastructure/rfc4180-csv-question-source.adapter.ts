import type { CsvQuestionSource, ParsedCsvQuestion } from '../domain/ports/csv-question-source.port';

/**
 * Fixed CSV column contract (design.md "CSV contract"):
 *   prompt,option_a,option_b,option_c,option_d,correct_option,topic,difficulty,explanation
 * Column ORDER in the source file does not matter — columns are matched by
 * (trimmed, lower-cased) header name, not position.
 */
const OPTION_LETTERS = ['a', 'b', 'c', 'd'] as const;

/** One tokenized physical CSV row plus the 1-based source line it STARTS on (a row spanning a multi-line quoted field is attributed to its first physical line). */
interface TokenizedRow {
  cells: string[];
  line: number;
}

/**
 * Zero-dependency RFC-4180 tokenizer. Turns raw CSV text into one
 * `TokenizedRow` per physical CSV row (header included), each carrying the
 * 1-based source-file line it starts on so callers can report accurate
 * `rowNumber`s even when blank lines or multi-line quoted fields shift a
 * row's physical position away from its position in the filtered/data-only
 * array.
 *
 * Handles:
 *   - quoted fields (`"..."`), including a comma or a newline embedded
 *     inside the quotes (does NOT treat them as field/row separators while
 *     inside a quoted field)
 *   - the RFC-4180 escaped-quote convention (`""` inside a quoted field
 *     becomes a single literal `"`)
 *   - both CRLF and bare-LF line endings, and a final row with no trailing
 *     newline
 *   - an empty string input (`''`) -> `[]`
 *
 * Deliberately lenient, never throws: an unterminated quote at end-of-input
 * simply closes at EOF rather than raising a parse error — malformed rows
 * are a downstream (use-case + `Question` constructor) validation concern,
 * never a reason to abort the whole file (spec.md SKIP-INVALID policy).
 */
function tokenizeCsv(content: string): TokenizedRow[] {
  const rows: TokenizedRow[] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push({ cells: row, line: rowStartLine });
    row = [];
  };

  let i = 0;
  const length = content.length;
  while (i < length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      if (char === '\n') {
        // A newline embedded inside a quoted field is part of the row's
        // content, not a row terminator — but it still advances the
        // physical line counter for rows that follow.
        field += char;
        line += 1;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (char === '\r') {
      if (content[i + 1] === '\n') i += 1;
      pushRow();
      line += 1;
      rowStartLine = line;
      i += 1;
      continue;
    }
    if (char === '\n') {
      pushRow();
      line += 1;
      rowStartLine = line;
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Flush a trailing field/row that had no terminating newline.
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

function isBlankRow(row: TokenizedRow): boolean {
  return row.cells.every((cell) => cell.trim() === '');
}

/**
 * Rfc4180CsvQuestionSource — production `CsvQuestionSource` adapter.
 *
 * Structural mapping ONLY: a row with a blank prompt, fewer than two
 * non-blank options, or a `correct_option` that does not match any
 * non-blank option cell is still returned as a `ParsedCsvQuestion` (never
 * dropped or thrown here) — `ImportQuestionsFromCsvUseCase` is the layer
 * that funnels each row through `new Question(...)` and decides
 * import-vs-skip.
 */
export class Rfc4180CsvQuestionSource implements CsvQuestionSource {
  parse(content: string): ParsedCsvQuestion[] {
    const rows = tokenizeCsv(content).filter((row) => !isBlankRow(row));
    if (rows.length === 0) return [];

    const header = rows[0]!.cells.map((cell) => cell.trim().toLowerCase());
    const dataRows = rows.slice(1);

    const columnIndex = (name: string): number => header.indexOf(name);
    const cell = (row: string[], name: string): string => {
      const index = columnIndex(name);
      if (index === -1) return '';
      return (row[index] ?? '').trim();
    };

    return dataRows.map((row) => {
      // The tokenizer already tracks each row's physical source-file line
      // (accounting for filtered blank lines and multi-line quoted fields),
      // so it doubles as the port contract's "1-based row number as it
      // appears in the source file" — no separate offset math needed.
      const rowNumber = row.line;

      const options = OPTION_LETTERS.map((letter) => ({
        id: letter,
        label: cell(row.cells, `option_${letter}`),
      })).filter((option) => option.label !== '');

      const topic = cell(row.cells, 'topic') || null;
      // Lower-cased for parity with `correct_option` below — `parseDifficulty`
      // (domain/value-objects/difficulty.vo.ts) only accepts lowercase
      // "easy"/"medium"/"hard", so a mixed-case CSV cell like "Easy" or
      // "HARD" must be normalized here or it is wrongly rejected downstream.
      const difficulty = cell(row.cells, 'difficulty').toLowerCase() || null;
      const explanation = cell(row.cells, 'explanation') || null;

      const parsed: ParsedCsvQuestion = {
        rowNumber,
        prompt: cell(row.cells, 'prompt'),
        options,
        correctOptionId: cell(row.cells, 'correct_option').toLowerCase(),
        topic,
        difficulty,
        explanation,
      };
      return parsed;
    });
  }
}

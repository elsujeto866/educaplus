import type { CsvQuestionSource, ParsedCsvQuestion } from '../domain/ports/csv-question-source.port';

/**
 * Fixed CSV column contract (design.md "CSV contract"):
 *   prompt,option_a,option_b,option_c,option_d,correct_option,topic,difficulty,explanation
 * Column ORDER in the source file does not matter — columns are matched by
 * (trimmed, lower-cased) header name, not position.
 */
const OPTION_LETTERS = ['a', 'b', 'c', 'd'] as const;

/**
 * Zero-dependency RFC-4180 tokenizer. Turns raw CSV text into a matrix of
 * string cells — one array per physical CSV row (header included).
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
function tokenizeCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
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
      i += 1;
      continue;
    }
    if (char === '\n') {
      pushRow();
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

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === '');
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

    const header = rows[0]!.map((cell) => cell.trim().toLowerCase());
    const dataRows = rows.slice(1);

    const columnIndex = (name: string): number => header.indexOf(name);
    const cell = (row: string[], name: string): string => {
      const index = columnIndex(name);
      if (index === -1) return '';
      return (row[index] ?? '').trim();
    };

    return dataRows.map((row, dataIndex) => {
      const rowNumber = dataIndex + 2; // +1 for 1-based, +1 for the header row itself

      const options = OPTION_LETTERS.map((letter) => ({
        id: letter,
        label: cell(row, `option_${letter}`),
      })).filter((option) => option.label !== '');

      const topic = cell(row, 'topic') || null;
      const difficulty = cell(row, 'difficulty') || null;
      const explanation = cell(row, 'explanation') || null;

      const parsed: ParsedCsvQuestion = {
        rowNumber,
        prompt: cell(row, 'prompt'),
        options,
        correctOptionId: cell(row, 'correct_option').toLowerCase(),
        topic,
        difficulty,
        explanation,
      };
      return parsed;
    });
  }
}

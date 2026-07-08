/**
 * Rfc4180CsvQuestionSource unit tests — pure string-in/structure-out parsing,
 * no DB, no Question construction. `parse()` never throws: a structurally
 * odd row (blank prompt, dangling correct_option, too few options) is still
 * returned as a `ParsedCsvQuestion` — validation is
 * `ImportQuestionsFromCsvUseCase`'s job (see its own spec file).
 */

import { describe, it, expect } from 'vitest';
import { Rfc4180CsvQuestionSource } from '../../../src/modules/simulator/infrastructure/rfc4180-csv-question-source.adapter';

const HEADER = 'prompt,option_a,option_b,option_c,option_d,correct_option,topic,difficulty,explanation';

describe('Rfc4180CsvQuestionSource', () => {
  const source = new Rfc4180CsvQuestionSource();

  it('parses a simple well-formed row', () => {
    const csv = `${HEADER}\n¿Cuánto es 2+2?,3,4,,,b,aritmética,easy,Suma básica\n`;

    const result = source.parse(csv);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      rowNumber: 2,
      prompt: '¿Cuánto es 2+2?',
      options: [
        { id: 'a', label: '3' },
        { id: 'b', label: '4' },
      ],
      correctOptionId: 'b',
      topic: 'aritmética',
      difficulty: 'easy',
      explanation: 'Suma básica',
    });
  });

  it('parses multiple rows and assigns rowNumber counting the header as row 1', () => {
    const csv = `${HEADER}\nP1,A,B,,,a,,,\nP2,A,B,,,b,,,\nP3,A,B,,,a,,,\n`;

    const result = source.parse(csv);

    expect(result.map((r) => r.rowNumber)).toEqual([2, 3, 4]);
    expect(result.map((r) => r.prompt)).toEqual(['P1', 'P2', 'P3']);
  });

  it('handles quoted fields with embedded commas', () => {
    const csv = `${HEADER}\n"¿Cuál es la capital, correctamente?",Madrid,"París, Francia",,,b,geografía,medium,\n`;

    const result = source.parse(csv);

    expect(result[0]!.prompt).toBe('¿Cuál es la capital, correctamente?');
    expect(result[0]!.options).toEqual([
      { id: 'a', label: 'Madrid' },
      { id: 'b', label: 'París, Francia' },
    ]);
  });

  it('handles quoted fields with embedded newlines', () => {
    const csv = `${HEADER}\n"Line one\nLine two",A,B,,,a,,,\n`;

    const result = source.parse(csv);

    expect(result[0]!.prompt).toBe('Line one\nLine two');
  });

  it('handles the RFC-4180 escaped-quote convention ("" -> ")', () => {
    const csv = `${HEADER}\n"She said ""hello""",A,B,,,a,,,\n`;

    const result = source.parse(csv);

    expect(result[0]!.prompt).toBe('She said "hello"');
  });

  it('handles CRLF line endings', () => {
    const csv = `${HEADER}\r\nP1,A,B,,,a,,,\r\nP2,A,B,,,b,,,\r\n`;

    const result = source.parse(csv);

    expect(result).toHaveLength(2);
    expect(result[0]!.prompt).toBe('P1');
    expect(result[1]!.prompt).toBe('P2');
  });

  it('drops blank option cells and keeps only non-blank options', () => {
    const csv = `${HEADER}\nP1,A,B,C,,c,,,\n`;

    const result = source.parse(csv);

    expect(result[0]!.options).toEqual([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ]);
  });

  it('returns an empty array for an empty file', () => {
    expect(source.parse('')).toEqual([]);
  });

  it('returns an empty array for a header-only file', () => {
    expect(source.parse(`${HEADER}\n`)).toEqual([]);
  });

  it('returns an empty array for a header-only file with no trailing newline', () => {
    expect(source.parse(HEADER)).toEqual([]);
  });

  it('matches columns by header name, not by physical column order', () => {
    const reordered = 'correct_option,prompt,option_b,option_a,topic,difficulty,explanation,option_c,option_d';
    const csv = `${reordered}\nb,¿Reordenado?,B,A,tema,hard,expl,,\n`;

    const result = source.parse(csv);

    expect(result[0]!.prompt).toBe('¿Reordenado?');
    expect(result[0]!.correctOptionId).toBe('b');
    expect(result[0]!.options).toEqual([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]);
    expect(result[0]!.topic).toBe('tema');
    expect(result[0]!.difficulty).toBe('hard');
  });

  it('does not throw on a malformed row (missing trailing columns) — returns a structurally-odd ParsedCsvQuestion instead', () => {
    const csv = `${HEADER}\nOnly a prompt\n`;

    const result = source.parse(csv);

    expect(result).toHaveLength(1);
    expect(result[0]!.prompt).toBe('Only a prompt');
    expect(result[0]!.options).toEqual([]);
    expect(result[0]!.correctOptionId).toBe('');
  });

  it('does not throw on an unterminated quote at end of input', () => {
    const csv = `${HEADER}\n"Unterminated prompt,A,B,,,a,,,`;

    expect(() => source.parse(csv)).not.toThrow();
  });

  it('skips fully blank lines between data rows', () => {
    const csv = `${HEADER}\nP1,A,B,,,a,,,\n\nP2,A,B,,,b,,,\n`;

    const result = source.parse(csv);

    expect(result.map((r) => r.prompt)).toEqual(['P1', 'P2']);
  });

  it('defaults topic/difficulty/explanation to null when blank', () => {
    const csv = `${HEADER}\nP1,A,B,,,a,,,\n`;

    const result = source.parse(csv);

    expect(result[0]!.topic).toBeNull();
    expect(result[0]!.difficulty).toBeNull();
    expect(result[0]!.explanation).toBeNull();
  });
});

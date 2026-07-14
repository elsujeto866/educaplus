/**
 * `computeBankStats` — pure helper feeding the bank detail overview
 * ("Vista general"). Zero framework imports, unit-testable without
 * React/DOM. Input rows mirror `QuestionRowData`'s topic/difficulty
 * fields (plain strings/null) — never the domain `Question` entity.
 */

import { describe, it, expect } from 'vitest';
import { computeBankStats } from '../../../src/app/dashboard/simulators/banks/[bankId]/_lib/bank-stats';

describe('computeBankStats', () => {
  it('returns all-zero stats for an empty bank', () => {
    const stats = computeBankStats([]);

    expect(stats.total).toBe(0);
    expect(stats.byDifficulty).toEqual({ easy: 0, medium: 0, hard: 0, unclassified: 0 });
    expect(stats.byTopic).toEqual([]);
  });

  it('counts the total number of questions', () => {
    const stats = computeBankStats([
      { topic: null, difficulty: null },
      { topic: null, difficulty: null },
      { topic: null, difficulty: null },
    ]);

    expect(stats.total).toBe(3);
  });

  it('buckets by difficulty, including "unclassified" for null difficulty', () => {
    const stats = computeBankStats([
      { topic: null, difficulty: 'easy' },
      { topic: null, difficulty: 'easy' },
      { topic: null, difficulty: 'medium' },
      { topic: null, difficulty: 'hard' },
      { topic: null, difficulty: null },
    ]);

    expect(stats.byDifficulty).toEqual({ easy: 2, medium: 1, hard: 1, unclassified: 1 });
  });

  it('buckets by topic, grouping null topics under "Sin tema"', () => {
    const stats = computeBankStats([
      { topic: 'Álgebra', difficulty: 'easy' },
      { topic: 'Álgebra', difficulty: 'medium' },
      { topic: null, difficulty: 'easy' },
    ]);

    expect(stats.byTopic).toEqual(
      expect.arrayContaining([
        { topic: 'Álgebra', count: 2 },
        { topic: 'Sin tema', count: 1 },
      ]),
    );
    expect(stats.byTopic).toHaveLength(2);
  });

  it('orders topics by count descending', () => {
    const stats = computeBankStats([
      { topic: 'Geometría', difficulty: null },
      { topic: 'Álgebra', difficulty: null },
      { topic: 'Álgebra', difficulty: null },
      { topic: 'Álgebra', difficulty: null },
      { topic: 'Trigonometría', difficulty: null },
      { topic: 'Trigonometría', difficulty: null },
    ]);

    expect(stats.byTopic.map((entry) => entry.topic)).toEqual(['Álgebra', 'Trigonometría', 'Geometría']);
  });

  it('treats a blank/whitespace-only topic as "Sin tema"', () => {
    const stats = computeBankStats([{ topic: '   ', difficulty: null }]);

    expect(stats.byTopic).toEqual([{ topic: 'Sin tema', count: 1 }]);
  });
});

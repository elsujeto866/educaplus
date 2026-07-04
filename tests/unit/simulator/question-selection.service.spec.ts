/**
 * Question-selection engine unit tests — Slice S3, Decision 7.
 *
 * PURE domain service. Randomness is injected via `RandomPort` — this file
 * NEVER calls `Math.random` directly (per the apply-phase instruction: some
 * runtimes here disallow it, and the design requires testable randomness).
 * Exhaustive edge cases: exact count, one short, empty bank, topic filter
 * with too few matches, topic filter with more than enough matches, and
 * deterministic RNG consumption.
 */

import { describe, it, expect } from 'vitest';
import {
  filterByTopic,
  selectQuestions,
} from '../../../src/modules/simulator/domain/services/question-selection.service';
import type { RandomPort } from '../../../src/modules/simulator/domain/ports/random.port';
import { Question } from '../../../src/modules/simulator/domain/question.entity';

const now = new Date('2025-01-01T00:00:00Z');

function makeQuestion(id: string, topic: string | null = null): Question {
  return new Question({
    id,
    bankId: 'bank-1',
    academyId: 'org_A',
    prompt: `Pregunta ${id}`,
    options: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    correctOptionId: 'a',
    topic,
    difficulty: null,
    explanation: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
  });
}

/** Deterministic fake RNG — cycles through a fixed sequence of [0,1) values. */
function fakeRng(sequence: number[]): RandomPort {
  let i = 0;
  return {
    next: () => {
      const value = sequence[i % sequence.length];
      i += 1;
      return value as number;
    },
  };
}

describe('filterByTopic', () => {
  it('returns the full pool unchanged when topicFilter is null', () => {
    const pool = [makeQuestion('q1', 'algebra'), makeQuestion('q2', 'geometria')];
    expect(filterByTopic(pool, null)).toEqual(pool);
  });

  it('returns the full pool unchanged when topicFilter is undefined', () => {
    const pool = [makeQuestion('q1', 'algebra')];
    expect(filterByTopic(pool, undefined)).toEqual(pool);
  });

  it('treats an empty topicFilter array as "no filter"', () => {
    const pool = [makeQuestion('q1', 'algebra'), makeQuestion('q2', 'geometria')];
    expect(filterByTopic(pool, [])).toEqual(pool);
  });

  it('keeps only questions whose topic is in the filter set', () => {
    const pool = [makeQuestion('q1', 'algebra'), makeQuestion('q2', 'geometria'), makeQuestion('q3', 'algebra')];
    const filtered = filterByTopic(pool, ['algebra']);
    expect(filtered.map((q) => q.id)).toEqual(['q1', 'q3']);
  });

  it('excludes questions with a null topic when a filter is set', () => {
    const pool = [makeQuestion('q1', 'algebra'), makeQuestion('q2', null)];
    const filtered = filterByTopic(pool, ['algebra']);
    expect(filtered.map((q) => q.id)).toEqual(['q1']);
  });

  it('does not mutate the input pool', () => {
    const pool = [makeQuestion('q1', 'algebra')];
    const snapshot = [...pool];
    filterByTopic(pool, ['algebra']);
    expect(pool).toEqual(snapshot);
  });
});

describe('selectQuestions', () => {
  it('returns an empty array for an empty bank (no error)', () => {
    const result = selectQuestions([], 5, null, fakeRng([0]));
    expect(result).toEqual([]);
  });

  it('uses all available questions when the pool matches the requested count exactly', () => {
    const pool = [makeQuestion('q1'), makeQuestion('q2'), makeQuestion('q3')];
    const result = selectQuestions(pool, 3, null, fakeRng([0]));
    expect(result).toHaveLength(3);
    expect(result.map((q) => q.id).sort()).toEqual(['q1', 'q2', 'q3']);
  });

  it('uses all available questions when the pool is one short of the requested count', () => {
    const pool = [makeQuestion('q1'), makeQuestion('q2')];
    const result = selectQuestions(pool, 3, null, fakeRng([0]));
    expect(result).toHaveLength(2);
    expect(result.map((q) => q.id).sort()).toEqual(['q1', 'q2']);
  });

  it('uses all matching questions when the topic filter yields too few', () => {
    const pool = [makeQuestion('q1', 'algebra'), makeQuestion('q2', 'geometria'), makeQuestion('q3', 'algebra')];
    const result = selectQuestions(pool, 5, ['algebra'], fakeRng([0]));
    expect(result.map((q) => q.id).sort()).toEqual(['q1', 'q3']);
  });

  it('honors the topicFilter before drawing the random subset', () => {
    const pool = [
      makeQuestion('q1', 'algebra'),
      makeQuestion('q2', 'geometria'),
      makeQuestion('q3', 'algebra'),
      makeQuestion('q4', 'algebra'),
    ];
    const result = selectQuestions(pool, 2, ['algebra'], fakeRng([0.1, 0.5, 0.9]));
    expect(result).toHaveLength(2);
    for (const question of result) {
      expect(question.topic).toBe('algebra');
    }
  });

  it('draws exactly N distinct questions when the pool exceeds the requested count', () => {
    const pool = [makeQuestion('q1'), makeQuestion('q2'), makeQuestion('q3'), makeQuestion('q4'), makeQuestion('q5')];
    const result = selectQuestions(pool, 3, null, fakeRng([0.9, 0.1, 0.5, 0.2]));

    expect(result).toHaveLength(3);
    const ids = result.map((q) => q.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(pool.map((q) => q.id)).toContain(id);
    }
  });

  it('is deterministic for a fixed RNG sequence', () => {
    const pool = [makeQuestion('q1'), makeQuestion('q2'), makeQuestion('q3'), makeQuestion('q4'), makeQuestion('q5')];
    const rngSequence = [0.9, 0.1, 0.5, 0.2];

    const first = selectQuestions(pool, 3, null, fakeRng(rngSequence));
    const second = selectQuestions(pool, 3, null, fakeRng(rngSequence));

    expect(first.map((q) => q.id)).toEqual(second.map((q) => q.id));
  });

  it('produces a different draw for a different RNG sequence (proves the RNG is actually consumed)', () => {
    const pool = [makeQuestion('q1'), makeQuestion('q2'), makeQuestion('q3'), makeQuestion('q4'), makeQuestion('q5')];

    const drawA = selectQuestions(pool, 3, null, fakeRng([0, 0, 0]));
    const drawB = selectQuestions(pool, 3, null, fakeRng([0.99, 0.99, 0.99]));

    expect(drawA.map((q) => q.id)).not.toEqual(drawB.map((q) => q.id));
  });

  it('does not mutate the input pool', () => {
    const pool = [makeQuestion('q1'), makeQuestion('q2'), makeQuestion('q3')];
    const snapshot = pool.map((q) => q.id);
    selectQuestions(pool, 2, null, fakeRng([0.5, 0.5]));
    expect(pool.map((q) => q.id)).toEqual(snapshot);
  });
});

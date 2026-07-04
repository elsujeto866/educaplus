import { describe, it, expect } from 'vitest';
import { parseDifficulty } from '../../../src/modules/simulator/domain/value-objects/difficulty.vo';

describe('parseDifficulty', () => {
  it.each(['easy', 'medium', 'hard'] as const)('accepts "%s"', (value) => {
    expect(parseDifficulty(value)).toBe(value);
  });

  it('throws for an unknown difficulty', () => {
    expect(() => parseDifficulty('extreme')).toThrow(/Invalid difficulty/);
  });

  it('throws for an empty string', () => {
    expect(() => parseDifficulty('')).toThrow(/Invalid difficulty/);
  });
});

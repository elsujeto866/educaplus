/**
 * extractMarkdown — pure helper that reads the markdown string out of a
 * text lesson's opaque JSONB body. The domain layer keeps `body: JSONValue`
 * unconstrained; the `{ format: 'markdown', value }` envelope is a
 * delivery-layer convention (design.md §7), so this lives outside the
 * domain and does a runtime shape check rather than trusting a type import.
 */

import { describe, it, expect } from 'vitest';
import { extractMarkdown } from '../../../src/app/dashboard/courses/[courseId]/lessons/[lessonId]/_lib/extract-markdown';

describe('extractMarkdown', () => {
  it('returns the value from a well-formed markdown envelope', () => {
    expect(extractMarkdown({ format: 'markdown', value: '# Hola' })).toBe('# Hola');
  });

  it('returns an empty string when body is null', () => {
    expect(extractMarkdown(null)).toBe('');
  });

  it('returns an empty string when body is not an object', () => {
    expect(extractMarkdown('raw string')).toBe('');
    expect(extractMarkdown(42)).toBe('');
  });

  it('returns an empty string when body is an array', () => {
    expect(extractMarkdown(['not', 'an', 'envelope'])).toBe('');
  });

  it('returns an empty string when value is missing or not a string', () => {
    expect(extractMarkdown({ format: 'markdown' })).toBe('');
    expect(extractMarkdown({ format: 'markdown', value: 123 })).toBe('');
  });
});

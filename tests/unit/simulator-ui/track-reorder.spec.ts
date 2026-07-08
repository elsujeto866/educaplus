/**
 * computeReorderedIds — pure function driving the track step up/down
 * reorder actions. Mirrors `tests/unit/course-authoring-ui/reorder.spec.ts`
 * verbatim (identical contract): given the full ordered id list and a
 * target id, it returns a NEW array with the target swapped with its
 * neighbor, or the SAME array reference when the move is a no-op (already
 * at the boundary).
 */

import { describe, it, expect } from 'vitest';
import { computeReorderedIds } from '../../../src/app/dashboard/simulators/tracks/_lib/reorder';

describe('computeReorderedIds (tracks)', () => {
  it('moves a middle item up by swapping it with its previous neighbor', () => {
    const result = computeReorderedIds(['a', 'b', 'c'], 'b', 'up');
    expect(result).toEqual(['b', 'a', 'c']);
  });

  it('moves a middle item down by swapping it with its next neighbor', () => {
    const result = computeReorderedIds(['a', 'b', 'c'], 'b', 'down');
    expect(result).toEqual(['a', 'c', 'b']);
  });

  it('returns the SAME array reference when moving the first item up (no-op)', () => {
    const input = ['a', 'b', 'c'];
    const result = computeReorderedIds(input, 'a', 'up');
    expect(result).toBe(input);
  });

  it('returns the SAME array reference when moving the last item down (no-op)', () => {
    const input = ['a', 'b', 'c'];
    const result = computeReorderedIds(input, 'c', 'down');
    expect(result).toBe(input);
  });

  it('returns the SAME array reference when the target id is not found', () => {
    const input = ['a', 'b', 'c'];
    const result = computeReorderedIds(input, 'missing', 'up');
    expect(result).toBe(input);
  });
});

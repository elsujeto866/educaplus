export type ReorderDirection = 'up' | 'down';

/**
 * Pure computation for track step reordering. Identical contract to
 * `courses/[courseId]/_lib/reorder.ts`'s `computeReorderedIds` (colocated
 * copy per this route's own `_lib`, not a cross-feature import — mirrors how
 * `simulators` and `courses` each own their authoring helpers).
 *
 * `orderedIds` is the FULL ordered list of step ids for the track — matches
 * `ReorderTrackStepsUseCase.execute`'s `orderedStepIds` contract, which
 * requires every id in the scope, not a partial diff.
 *
 * Swaps `targetId` with its adjacent neighbor in the requested direction.
 * Returns the SAME array reference (no-op) when `targetId` is already at
 * the boundary (first item moving up / last item moving down) or is not
 * found — callers use reference equality to skip the mutation call.
 */
export function computeReorderedIds(
  orderedIds: string[],
  targetId: string,
  direction: ReorderDirection,
): string[] {
  const index = orderedIds.indexOf(targetId);
  if (index === -1) return orderedIds;

  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= orderedIds.length) return orderedIds;

  const result = [...orderedIds];
  const temp = result[index]!;
  result[index] = result[swapWith]!;
  result[swapWith] = temp;
  return result;
}

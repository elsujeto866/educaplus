/**
 * SimulatorTrackProgress entity unit tests — Phase 3 (gamified-simulators,
 * progression). Mirrors `simulator-track-step.entity.spec.ts`'s style: eager
 * constructor validation, pure TS, no infrastructure.
 *
 * Covers the monotonic-frontier invariant (design.md "inv: monotonic
 * non-decreasing"): `advanceTo()` moves the frontier forward, but NEVER
 * regresses — passing an already-passed step (or any position at/behind the
 * current frontier) is a pure no-op that returns the SAME instance.
 */

import { describe, it, expect } from 'vitest';
import {
  SimulatorTrackProgress,
  type SimulatorTrackProgressProps,
} from '../../../src/modules/simulator/domain/simulator-track-progress.entity';
import { InvalidSimulatorTrackProgressError } from '../../../src/modules/simulator/domain/errors';

const now = new Date('2025-01-01T00:00:00Z');

function baseProps(
  overrides: Partial<SimulatorTrackProgressProps> = {},
): SimulatorTrackProgressProps {
  return {
    id: 'progress-1',
    trackId: 'track-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    highestUnlockedPosition: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('SimulatorTrackProgress entity', () => {
  it('constructs with valid props', () => {
    const progress = new SimulatorTrackProgress(baseProps());

    expect(progress.id).toBe('progress-1');
    expect(progress.trackId).toBe('track-1');
    expect(progress.academyId).toBe('org_A');
    expect(progress.clerkUserId).toBe('user_1');
    expect(progress.highestUnlockedPosition).toBe(1);
  });

  it('defaults highestUnlockedPosition to 1 when omitted', () => {
    const { highestUnlockedPosition: _omit, ...rest } = baseProps();
    const progress = new SimulatorTrackProgress(
      rest as SimulatorTrackProgressProps,
    );

    expect(progress.highestUnlockedPosition).toBe(1);
  });

  it('throws when id is missing', () => {
    expect(() => new SimulatorTrackProgress(baseProps({ id: '' }))).toThrow(
      'SimulatorTrackProgress: id is required',
    );
  });

  it('throws when trackId is missing', () => {
    expect(() => new SimulatorTrackProgress(baseProps({ trackId: '' }))).toThrow(
      'SimulatorTrackProgress: trackId is required',
    );
  });

  it('throws when academyId is missing', () => {
    expect(() => new SimulatorTrackProgress(baseProps({ academyId: '' }))).toThrow(
      'SimulatorTrackProgress: academyId is required',
    );
  });

  it('throws when clerkUserId is missing', () => {
    expect(() => new SimulatorTrackProgress(baseProps({ clerkUserId: '' }))).toThrow(
      'SimulatorTrackProgress: clerkUserId is required',
    );
  });

  it.each([0, -1, 1.5])(
    'throws InvalidSimulatorTrackProgressError when highestUnlockedPosition is %s',
    (highestUnlockedPosition) => {
      expect(() => new SimulatorTrackProgress(baseProps({ highestUnlockedPosition }))).toThrow(
        InvalidSimulatorTrackProgressError,
      );
    },
  );

  it('accepts the boundary value 1', () => {
    expect(() => new SimulatorTrackProgress(baseProps({ highestUnlockedPosition: 1 }))).not.toThrow();
  });

  describe('advanceTo()', () => {
    it('advances the frontier forward and bumps updatedAt', () => {
      const progress = new SimulatorTrackProgress(baseProps({ highestUnlockedPosition: 1 }));
      const at = new Date('2025-03-01T00:00:00Z');

      const advanced = progress.advanceTo(2, at);

      expect(advanced).not.toBe(progress);
      expect(advanced.highestUnlockedPosition).toBe(2);
      expect(advanced.updatedAt).toEqual(at);
      // Original instance is untouched — pure/immutable.
      expect(progress.highestUnlockedPosition).toBe(1);
    });

    it('is a no-op (returns the SAME instance) when advancing to the current frontier — idempotent re-pass', () => {
      const progress = new SimulatorTrackProgress(baseProps({ highestUnlockedPosition: 2 }));

      const result = progress.advanceTo(2);

      expect(result).toBe(progress);
    });

    it('NEVER regresses: advancing to a position behind the current frontier returns the SAME instance', () => {
      const progress = new SimulatorTrackProgress(baseProps({ highestUnlockedPosition: 3 }));

      const result = progress.advanceTo(1);

      expect(result).toBe(progress);
      expect(result.highestUnlockedPosition).toBe(3);
    });

    it('advancing twice to the same next position only moves the frontier once (monotonic, no double-advance)', () => {
      const progress = new SimulatorTrackProgress(baseProps({ highestUnlockedPosition: 1 }));

      const first = progress.advanceTo(2);
      const second = first.advanceTo(2);

      expect(second).toBe(first);
      expect(second.highestUnlockedPosition).toBe(2);
    });
  });
});

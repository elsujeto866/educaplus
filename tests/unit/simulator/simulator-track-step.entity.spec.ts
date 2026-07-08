/**
 * SimulatorTrackStep entity unit tests — Phase 2 (gamified-simulators, track authoring).
 *
 * Mirrors `question.entity.spec.ts`'s style: eager constructor validation,
 * pure TS, no infrastructure. Covers the `position >= 1` invariant (design.md
 * "SimulatorTrackStep ... inv: position>=1") plus the `withPosition()`
 * repositioning helper used by ReorderTrackSteps/RemoveTrackStep to
 * re-compact positions.
 */

import { describe, it, expect } from 'vitest';
import {
  SimulatorTrackStep,
  type SimulatorTrackStepProps,
} from '../../../src/modules/simulator/domain/simulator-track-step.entity';
import { InvalidSimulatorTrackStepError } from '../../../src/modules/simulator/domain/errors';

const now = new Date('2025-01-01T00:00:00Z');

function baseProps(overrides: Partial<SimulatorTrackStepProps> = {}): SimulatorTrackStepProps {
  return {
    id: 'step-1',
    trackId: 'track-1',
    academyId: 'org_A',
    simulatorId: 'sim-1',
    position: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('SimulatorTrackStep entity', () => {
  it('constructs with valid props', () => {
    const step = new SimulatorTrackStep(baseProps());

    expect(step.id).toBe('step-1');
    expect(step.trackId).toBe('track-1');
    expect(step.academyId).toBe('org_A');
    expect(step.simulatorId).toBe('sim-1');
    expect(step.position).toBe(1);
  });

  it('throws when id is missing', () => {
    expect(() => new SimulatorTrackStep(baseProps({ id: '' }))).toThrow(
      'SimulatorTrackStep: id is required',
    );
  });

  it('throws when trackId is missing', () => {
    expect(() => new SimulatorTrackStep(baseProps({ trackId: '' }))).toThrow(
      'SimulatorTrackStep: trackId is required',
    );
  });

  it('throws when academyId is missing', () => {
    expect(() => new SimulatorTrackStep(baseProps({ academyId: '' }))).toThrow(
      'SimulatorTrackStep: academyId is required',
    );
  });

  it('throws when simulatorId is missing', () => {
    expect(() => new SimulatorTrackStep(baseProps({ simulatorId: '' }))).toThrow(
      'SimulatorTrackStep: simulatorId is required',
    );
  });

  it.each([0, -1, 1.5])(
    'throws InvalidSimulatorTrackStepError when position is %s',
    (position) => {
      expect(() => new SimulatorTrackStep(baseProps({ position }))).toThrow(
        InvalidSimulatorTrackStepError,
      );
    },
  );

  it('accepts position boundary value 1', () => {
    expect(() => new SimulatorTrackStep(baseProps({ position: 1 }))).not.toThrow();
  });

  describe('withPosition()', () => {
    it('returns a new instance with the given position and updatedAt', () => {
      const step = new SimulatorTrackStep(baseProps({ position: 1 }));
      const at = new Date('2025-03-01T00:00:00Z');

      const moved = step.withPosition(2, at);

      expect(moved).not.toBe(step);
      expect(moved.position).toBe(2);
      expect(moved.updatedAt).toEqual(at);
      expect(step.position).toBe(1);
    });

    it('rejects an invalid target position', () => {
      const step = new SimulatorTrackStep(baseProps({ position: 1 }));
      expect(() => step.withPosition(0)).toThrow(InvalidSimulatorTrackStepError);
    });
  });
});

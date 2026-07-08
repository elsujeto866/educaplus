/**
 * SimulatorTrack entity unit tests — Phase 2 (gamified-simulators, track authoring).
 *
 * Mirrors `simulator.entity.spec.ts`'s style: eager constructor validation,
 * pure TS, no infrastructure. Covers the title invariant plus the immutable
 * publish()/unpublish() transitions (mirrors `Simulator.publish()/unpublish()`).
 */

import { describe, it, expect } from 'vitest';
import {
  SimulatorTrack,
  type SimulatorTrackProps,
} from '../../../src/modules/simulator/domain/simulator-track.entity';
import { InvalidSimulatorTrackError } from '../../../src/modules/simulator/domain/errors';

const now = new Date('2025-01-01T00:00:00Z');

function baseProps(overrides: Partial<SimulatorTrackProps> = {}): SimulatorTrackProps {
  return {
    id: 'track-1',
    academyId: 'org_A',
    title: 'Ruta de matemática',
    description: null,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('SimulatorTrack entity', () => {
  it('constructs with valid props', () => {
    const track = new SimulatorTrack(baseProps());

    expect(track.id).toBe('track-1');
    expect(track.academyId).toBe('org_A');
    expect(track.title).toBe('Ruta de matemática');
    expect(track.description).toBeNull();
    expect(track.status).toBe('draft');
  });

  it('defaults description to null when omitted', () => {
    const { description: _description, ...rest } = baseProps();
    const track = new SimulatorTrack(rest as SimulatorTrackProps);
    expect(track.description).toBeNull();
  });

  it('throws when id is missing', () => {
    expect(() => new SimulatorTrack(baseProps({ id: '' }))).toThrow('SimulatorTrack: id is required');
  });

  it('throws when academyId is missing', () => {
    expect(() => new SimulatorTrack(baseProps({ academyId: '' }))).toThrow(
      'SimulatorTrack: academyId is required',
    );
  });

  it('throws InvalidSimulatorTrackError when title is blank', () => {
    expect(() => new SimulatorTrack(baseProps({ title: '   ' }))).toThrow(InvalidSimulatorTrackError);
  });

  describe('publish()', () => {
    it('returns a new SimulatorTrack instance with status published', () => {
      const track = new SimulatorTrack(baseProps({ status: 'draft' }));
      const at = new Date('2025-02-01T00:00:00Z');

      const published = track.publish(at);

      expect(published).not.toBe(track);
      expect(published.status).toBe('published');
      expect(published.updatedAt).toEqual(at);
      expect(track.status).toBe('draft');
    });
  });

  describe('unpublish()', () => {
    it('returns a new SimulatorTrack instance with status draft', () => {
      const track = new SimulatorTrack(baseProps({ status: 'published' }));
      const at = new Date('2025-02-02T00:00:00Z');

      const unpublished = track.unpublish(at);

      expect(unpublished).not.toBe(track);
      expect(unpublished.status).toBe('draft');
      expect(unpublished.updatedAt).toEqual(at);
      expect(track.status).toBe('published');
    });
  });

  describe('isPublished', () => {
    it('is true only when status is published', () => {
      expect(new SimulatorTrack(baseProps({ status: 'published' })).isPublished).toBe(true);
      expect(new SimulatorTrack(baseProps({ status: 'draft' })).isPublished).toBe(false);
    });
  });
});

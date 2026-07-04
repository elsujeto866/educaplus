/**
 * Simulator entity unit tests — Slice S3.
 *
 * Mirrors `question-bank.entity.spec.ts`/`question.entity.spec.ts`'s style:
 * eager constructor validation, pure TS, no infrastructure. Covers every
 * invariant from design Decision 1 (simulators table) plus the immutable
 * publish()/unpublish() transitions (mirrors `Course.publish()/unpublish()`).
 */

import { describe, it, expect } from 'vitest';
import { Simulator, type SimulatorProps } from '../../../src/modules/simulator/domain/simulator.entity';
import { InvalidSimulatorError } from '../../../src/modules/simulator/domain/errors';

const now = new Date('2025-01-01T00:00:00Z');

function baseProps(overrides: Partial<SimulatorProps> = {}): SimulatorProps {
  return {
    id: 'sim-1',
    academyId: 'org_A',
    bankId: 'bank-1',
    title: 'Simulacro de matemática',
    description: null,
    questionCount: 10,
    passingScore: 70,
    timeLimitMinutes: 30,
    attemptLimit: 3,
    selectionStrategy: 'random',
    topicFilter: null,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Simulator entity', () => {
  it('constructs with valid props', () => {
    const sim = new Simulator(baseProps());

    expect(sim.id).toBe('sim-1');
    expect(sim.academyId).toBe('org_A');
    expect(sim.bankId).toBe('bank-1');
    expect(sim.title).toBe('Simulacro de matemática');
    expect(sim.description).toBeNull();
    expect(sim.questionCount).toBe(10);
    expect(sim.passingScore).toBe(70);
    expect(sim.timeLimitMinutes).toBe(30);
    expect(sim.attemptLimit).toBe(3);
    expect(sim.selectionStrategy).toBe('random');
    expect(sim.topicFilter).toBeNull();
    expect(sim.status).toBe('draft');
  });

  it('defaults description to null when omitted', () => {
    const { description: _description, ...rest } = baseProps();
    const sim = new Simulator(rest as SimulatorProps);
    expect(sim.description).toBeNull();
  });

  it('defaults topicFilter to null when omitted', () => {
    const { topicFilter: _topicFilter, ...rest } = baseProps();
    const sim = new Simulator(rest as SimulatorProps);
    expect(sim.topicFilter).toBeNull();
  });

  it('throws when id is missing', () => {
    expect(() => new Simulator(baseProps({ id: '' }))).toThrow('Simulator: id is required');
  });

  it('throws when academyId is missing', () => {
    expect(() => new Simulator(baseProps({ academyId: '' }))).toThrow('Simulator: academyId is required');
  });

  it('throws when bankId is missing', () => {
    expect(() => new Simulator(baseProps({ bankId: '' }))).toThrow('Simulator: bankId is required');
  });

  it('throws InvalidSimulatorError when title is blank', () => {
    expect(() => new Simulator(baseProps({ title: '   ' }))).toThrow(InvalidSimulatorError);
  });

  it.each([0, -1, 1.5])('throws InvalidSimulatorError when questionCount is %s', (questionCount) => {
    expect(() => new Simulator(baseProps({ questionCount }))).toThrow(InvalidSimulatorError);
  });

  it.each([-1, 101, 50.5])('throws InvalidSimulatorError when passingScore is %s', (passingScore) => {
    expect(() => new Simulator(baseProps({ passingScore }))).toThrow(InvalidSimulatorError);
  });

  it('accepts passingScore boundary values 0 and 100', () => {
    expect(() => new Simulator(baseProps({ passingScore: 0 }))).not.toThrow();
    expect(() => new Simulator(baseProps({ passingScore: 100 }))).not.toThrow();
  });

  it.each([0, -5, 2.2])('throws InvalidSimulatorError when timeLimitMinutes is %s', (timeLimitMinutes) => {
    expect(() => new Simulator(baseProps({ timeLimitMinutes }))).toThrow(InvalidSimulatorError);
  });

  it.each([0, -1, 1.1])('throws InvalidSimulatorError when attemptLimit is %s', (attemptLimit) => {
    expect(() => new Simulator(baseProps({ attemptLimit }))).toThrow(InvalidSimulatorError);
  });

  it('throws InvalidSimulatorError for an unsupported selectionStrategy', () => {
    expect(() =>
      new Simulator(baseProps({ selectionStrategy: 'weighted' as unknown as 'random' })),
    ).toThrow(InvalidSimulatorError);
  });

  it('throws InvalidSimulatorError when topicFilter contains a blank entry', () => {
    expect(() => new Simulator(baseProps({ topicFilter: ['algebra', '  '] }))).toThrow(InvalidSimulatorError);
  });

  it('accepts a non-empty topicFilter', () => {
    const sim = new Simulator(baseProps({ topicFilter: ['algebra', 'geometria'] }));
    expect(sim.topicFilter).toEqual(['algebra', 'geometria']);
  });

  describe('publish()', () => {
    it('returns a new Simulator instance with status published', () => {
      const sim = new Simulator(baseProps({ status: 'draft' }));
      const at = new Date('2025-02-01T00:00:00Z');

      const published = sim.publish(at);

      expect(published).not.toBe(sim);
      expect(published.status).toBe('published');
      expect(published.updatedAt).toEqual(at);
      expect(sim.status).toBe('draft');
    });
  });

  describe('unpublish()', () => {
    it('returns a new Simulator instance with status draft', () => {
      const sim = new Simulator(baseProps({ status: 'published' }));
      const at = new Date('2025-02-02T00:00:00Z');

      const unpublished = sim.unpublish(at);

      expect(unpublished).not.toBe(sim);
      expect(unpublished.status).toBe('draft');
      expect(unpublished.updatedAt).toEqual(at);
      expect(sim.status).toBe('published');
    });
  });

  describe('isPublished', () => {
    it('is true only when status is published', () => {
      expect(new Simulator(baseProps({ status: 'published' })).isPublished).toBe(true);
      expect(new Simulator(baseProps({ status: 'draft' })).isPublished).toBe(false);
    });
  });

  describe('issuesCertificate (Slice S6)', () => {
    it('defaults to true when omitted', () => {
      const { issuesCertificate: _issuesCertificate, ...rest } = baseProps();
      const sim = new Simulator(rest as SimulatorProps);
      expect(sim.issuesCertificate).toBe(true);
    });

    it('accepts an explicit true value', () => {
      const sim = new Simulator(baseProps({ issuesCertificate: true }));
      expect(sim.issuesCertificate).toBe(true);
    });

    it('accepts an explicit false value', () => {
      const sim = new Simulator(baseProps({ issuesCertificate: false }));
      expect(sim.issuesCertificate).toBe(false);
    });

    it('is preserved through publish()/unpublish() transitions', () => {
      const sim = new Simulator(baseProps({ issuesCertificate: false, status: 'draft' }));
      expect(sim.publish().issuesCertificate).toBe(false);
      expect(sim.unpublish().issuesCertificate).toBe(false);
    });
  });
});

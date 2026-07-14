import { describe, it, expect } from 'vitest';
import { RequestStatus } from '../../../src/modules/academy/domain/value-objects/request-status.vo';

describe('RequestStatus', () => {
  it.each(['pending', 'approved', 'rejected'] as const)('accepts "%s"', (value) => {
    expect(RequestStatus.create(value).value).toBe(value);
  });

  it('throws for an unknown status', () => {
    expect(() => RequestStatus.create('archived')).toThrow(/Invalid request status/);
  });

  it('throws for an empty string', () => {
    expect(() => RequestStatus.create('')).toThrow(/Invalid request status/);
  });

  it('pending() factory returns a pending status', () => {
    expect(RequestStatus.pending().value).toBe('pending');
  });

  it('reports isPending correctly', () => {
    expect(RequestStatus.pending().isPending).toBe(true);
    expect(RequestStatus.create('approved').isPending).toBe(false);
  });

  it('allows pending -> approved transition', () => {
    const next = RequestStatus.pending().transitionTo('approved');
    expect(next.value).toBe('approved');
  });

  it('allows pending -> rejected transition', () => {
    const next = RequestStatus.pending().transitionTo('rejected');
    expect(next.value).toBe('rejected');
  });

  it('rejects approved -> rejected transition (already resolved)', () => {
    expect(() => RequestStatus.create('approved').transitionTo('rejected')).toThrow(
      /Invalid request status transition/,
    );
  });

  it('rejects rejected -> approved transition (already resolved)', () => {
    expect(() => RequestStatus.create('rejected').transitionTo('approved')).toThrow(
      /Invalid request status transition/,
    );
  });

  it('rejects pending -> pending transition (no-op is not a transition)', () => {
    expect(() => RequestStatus.pending().transitionTo('pending')).toThrow(
      /Invalid request status transition/,
    );
  });

  it('canTransitionTo returns false for an invalid transition without throwing', () => {
    expect(RequestStatus.create('approved').canTransitionTo('rejected')).toBe(false);
  });

  it('canTransitionTo returns true for a valid transition', () => {
    expect(RequestStatus.pending().canTransitionTo('approved')).toBe(true);
  });
});

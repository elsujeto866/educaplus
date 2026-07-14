import { describe, it, expect } from 'vitest';
import { JoinRequest } from '../../../src/modules/academy/domain/entities/join-request.entity';
import {
  JoinRequestAlreadyResolvedError,
  JoinRequestNotApprovedError,
} from '../../../src/modules/academy/domain/errors';

const now = new Date('2026-01-01T00:00:00Z');

describe('JoinRequest.createPending', () => {
  it('creates a pending request with a normalized email', () => {
    const jr = JoinRequest.createPending({
      id: 'jr-1',
      academyId: 'org_A',
      email: ' New@Student.com ',
      createdAt: now,
    });

    expect(jr.id).toBe('jr-1');
    expect(jr.academyId).toBe('org_A');
    expect(jr.email).toBe('new@student.com');
    expect(jr.status).toBe('pending');
    expect(jr.isPending).toBe(true);
    expect(jr.resolvedAt).toBeNull();
    expect(jr.resolvedBy).toBeNull();
    expect(jr.fulfilledAt).toBeNull();
    expect(jr.membershipId).toBeNull();
  });

  it('throws when id is missing', () => {
    expect(() =>
      JoinRequest.createPending({ id: '', academyId: 'org_A', email: 'a@b.com', createdAt: now }),
    ).toThrow(/id is required/);
  });

  it('throws when academyId is missing', () => {
    expect(() =>
      JoinRequest.createPending({ id: 'jr-1', academyId: '', email: 'a@b.com', createdAt: now }),
    ).toThrow(/academyId is required/);
  });

  it('throws for an invalid email', () => {
    expect(() =>
      JoinRequest.createPending({
        id: 'jr-1',
        academyId: 'org_A',
        email: 'not-an-email',
        createdAt: now,
      }),
    ).toThrow(/Invalid email/);
  });
});

describe('JoinRequest.approve', () => {
  it('transitions a pending request to approved', () => {
    const jr = JoinRequest.createPending({
      id: 'jr-1',
      academyId: 'org_A',
      email: 'new@student.com',
      createdAt: now,
    });

    const approved = jr.approve('admin_1', now);

    expect(approved.status).toBe('approved');
    expect(approved.resolvedBy).toBe('admin_1');
    expect(approved.resolvedAt).toEqual(now);
    expect(approved.isPending).toBe(false);
  });

  it('throws JoinRequestAlreadyResolvedError when approving an already-approved request', () => {
    const jr = JoinRequest.createPending({
      id: 'jr-1',
      academyId: 'org_A',
      email: 'new@student.com',
      createdAt: now,
    }).approve('admin_1', now);

    expect(() => jr.approve('admin_2', now)).toThrow(JoinRequestAlreadyResolvedError);
  });

  it('throws JoinRequestAlreadyResolvedError when approving an already-rejected request', () => {
    const jr = JoinRequest.createPending({
      id: 'jr-1',
      academyId: 'org_A',
      email: 'new@student.com',
      createdAt: now,
    }).reject('admin_1', now);

    expect(() => jr.approve('admin_2', now)).toThrow(JoinRequestAlreadyResolvedError);
  });
});

describe('JoinRequest.reject', () => {
  it('transitions a pending request to rejected', () => {
    const jr = JoinRequest.createPending({
      id: 'jr-1',
      academyId: 'org_A',
      email: 'new@student.com',
      createdAt: now,
    });

    const rejected = jr.reject('admin_1', now);

    expect(rejected.status).toBe('rejected');
    expect(rejected.resolvedBy).toBe('admin_1');
    expect(rejected.resolvedAt).toEqual(now);
  });

  it('throws JoinRequestAlreadyResolvedError when rejecting an already-resolved request (no double-resolve)', () => {
    const jr = JoinRequest.createPending({
      id: 'jr-1',
      academyId: 'org_A',
      email: 'new@student.com',
      createdAt: now,
    }).reject('admin_1', now);

    expect(() => jr.reject('admin_2', now)).toThrow(JoinRequestAlreadyResolvedError);
  });
});

describe('JoinRequest.fulfill', () => {
  it('sets fulfilledAt and membershipId on an approved request', () => {
    const approved = JoinRequest.createPending({
      id: 'jr-1',
      academyId: 'org_A',
      email: 'new@student.com',
      createdAt: now,
    }).approve('admin_1', now);

    const fulfilled = approved.fulfill('membership-1', now);

    expect(fulfilled.fulfilledAt).toEqual(now);
    expect(fulfilled.membershipId).toBe('membership-1');
  });

  it('throws JoinRequestNotApprovedError when fulfilling a pending request', () => {
    const jr = JoinRequest.createPending({
      id: 'jr-1',
      academyId: 'org_A',
      email: 'new@student.com',
      createdAt: now,
    });

    expect(() => jr.fulfill('membership-1', now)).toThrow(JoinRequestNotApprovedError);
  });

  it('is idempotent: fulfilling an already-fulfilled request is a no-op (same membershipId/fulfilledAt)', () => {
    const approved = JoinRequest.createPending({
      id: 'jr-1',
      academyId: 'org_A',
      email: 'new@student.com',
      createdAt: now,
    }).approve('admin_1', now);

    const first = approved.fulfill('membership-1', now);
    const second = first.fulfill('membership-2', new Date('2026-02-01T00:00:00Z'));

    expect(second.fulfilledAt).toEqual(now);
    expect(second.membershipId).toBe('membership-1');
  });
});

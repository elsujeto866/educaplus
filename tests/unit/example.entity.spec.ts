import { describe, it, expect } from 'vitest';
import { Academy } from '../../src/modules/academy/domain/academy.entity';
import { Membership } from '../../src/modules/academy/domain/membership.entity';
import { Slug } from '../../src/modules/academy/domain/value-objects/slug.vo';

describe('Academy', () => {
  const now = new Date('2024-01-01T00:00:00Z');

  it('can be instantiated with valid props', () => {
    const academy = new Academy({
      id: 'org_abc123',
      name: 'Test Academy',
      slug: 'test-academy',
      createdAt: now,
      updatedAt: now,
    });
    expect(academy.id).toBe('org_abc123');
    expect(academy.name).toBe('Test Academy');
    expect(academy.slug).toBe('test-academy');
    expect(academy.isDeleted).toBe(false);
  });

  it('throws when id is empty', () => {
    expect(() =>
      new Academy({ id: '', name: 'Test', slug: 'test', createdAt: now, updatedAt: now }),
    ).toThrow('id is required');
  });

  it('soft-deletes by returning a new immutable instance with deletedAt set', () => {
    const academy = new Academy({
      id: 'org_1',
      name: 'A',
      slug: 'a-academy',
      createdAt: now,
      updatedAt: now,
    });
    const deleted = academy.softDelete(now);
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.deletedAt).toBe(now);
    // original is unaffected
    expect(academy.isDeleted).toBe(false);
  });
});

describe('Membership', () => {
  const now = new Date('2024-01-01T00:00:00Z');

  it('can be instantiated with valid props', () => {
    const m = new Membership({
      id: 'uuid-1',
      academyId: 'org_abc',
      clerkUserId: 'user_xyz',
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    });
    expect(m.role).toBe('admin');
    expect(m.academyId).toBe('org_abc');
  });

  it('returns a new instance with updated role via withRole()', () => {
    const m = new Membership({
      id: 'uuid-1',
      academyId: 'org_abc',
      clerkUserId: 'user_xyz',
      role: 'student',
      createdAt: now,
      updatedAt: now,
    });
    const updated = m.withRole('instructor');
    expect(updated.role).toBe('instructor');
    expect(m.role).toBe('student'); // original unchanged
  });

  it('throws when academyId is empty', () => {
    expect(() =>
      new Membership({
        id: 'uuid-1',
        academyId: '',
        clerkUserId: 'user_xyz',
        role: 'admin',
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow('academyId is required');
  });
});

describe('Slug', () => {
  it('creates a valid slug', () => {
    const slug = Slug.create('my-academy');
    expect(slug.value).toBe('my-academy');
  });

  it('normalizes to lowercase', () => {
    const slug = Slug.create('MyAcademy');
    expect(slug.value).toBe('myacademy');
  });

  it('throws on invalid slug with leading hyphen', () => {
    expect(() => Slug.create('-invalid')).toThrow('Invalid slug');
  });

  it('creates a slug from a display name', () => {
    const slug = Slug.fromName('My Test Academy!');
    expect(slug.value).toBe('my-test-academy');
  });
});

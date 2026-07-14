import { describe, it, expect } from 'vitest';
import { Email } from '../../../src/modules/academy/domain/value-objects/email.vo';

describe('Email', () => {
  it('accepts a well-formed email', () => {
    const email = Email.create('new@student.com');
    expect(email.value).toBe('new@student.com');
  });

  it('normalizes mixed-case and surrounding whitespace', () => {
    const email = Email.create(' New@Student.com ');
    expect(email.value).toBe('new@student.com');
  });

  it('throws for an empty string', () => {
    expect(() => Email.create('')).toThrow(/Invalid email/);
  });

  it('throws for whitespace-only input', () => {
    expect(() => Email.create('   ')).toThrow(/Invalid email/);
  });

  it('throws for a string with no @', () => {
    expect(() => Email.create('not-an-email')).toThrow(/Invalid email/);
  });

  it('throws for a string with no domain', () => {
    expect(() => Email.create('new@')).toThrow(/Invalid email/);
  });

  it('throws for a string with no local part', () => {
    expect(() => Email.create('@student.com')).toThrow(/Invalid email/);
  });

  it('two emails differing only by case/whitespace are equal after normalization', () => {
    const a = Email.create('new@student.com');
    const b = Email.create(' New@Student.com ');
    expect(a.equals(b)).toBe(true);
  });

  it('toString returns the normalized value', () => {
    const email = Email.create(' New@Student.com ');
    expect(email.toString()).toBe('new@student.com');
  });
});

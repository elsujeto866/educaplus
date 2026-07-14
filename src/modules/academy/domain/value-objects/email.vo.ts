/**
 * Email value object — normalized (lowercase + trim) email address.
 *
 * Normalization happens at the domain boundary BEFORE persistence or
 * dedup comparison, per spec "Email Normalization" requirement.
 *
 * Pure TS — zero imports.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      throw new Error(`Invalid email "${raw}": must be a well-formed email address.`);
    }
    return new Email(normalized);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * Slug value object — URL-safe identifier for an academy.
 *
 * Rules:
 *  - 3–63 characters
 *  - lowercase letters, digits, and hyphens only
 *  - must start and end with a letter or digit (no leading/trailing hyphens)
 *
 * Pure TS — zero imports.
 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$|^[a-z0-9]{1,3}$/;

export class Slug {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(raw: string): Slug {
    const normalized = raw.trim().toLowerCase();
    if (!SLUG_PATTERN.test(normalized)) {
      throw new Error(
        `Invalid slug "${raw}": must be 3-63 chars, lowercase alphanumeric and hyphens only, not start/end with a hyphen.`,
      );
    }
    return new Slug(normalized);
  }

  static fromString(value: string): Slug {
    return Slug.create(value);
  }

  /** Produces a slug candidate from a display name (best-effort). */
  static fromName(name: string): Slug {
    const candidate = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 63);
    return Slug.create(candidate);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Slug): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

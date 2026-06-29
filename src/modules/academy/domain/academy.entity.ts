import type { Role } from '@/shared/kernel/tenant-context';

export interface AcademyProps {
  id: string;
  name: string;
  slug: string;
  settings?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

/**
 * Academy domain entity.
 *
 * `id` equals the Clerk org_id and is also the RLS discriminator value
 * (stored in `app.current_tenant_id` per transaction via withTenant).
 *
 * Pure TS — zero infrastructure imports.
 */
export class Academy {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly settings: Record<string, unknown> | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(props: AcademyProps) {
    if (!props.id) throw new Error('Academy: id is required');
    if (!props.name) throw new Error('Academy: name is required');
    if (!props.slug) throw new Error('Academy: slug is required');

    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.settings = props.settings ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt ?? null;
  }

  get isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  softDelete(at: Date = new Date()): Academy {
    return new Academy({ ...this, deletedAt: at, updatedAt: at });
  }
}

// Re-export Role so use-cases can import from a single domain source without
// reaching into shared-kernel directly. Domain → shared-kernel is allowed.
export type { Role };

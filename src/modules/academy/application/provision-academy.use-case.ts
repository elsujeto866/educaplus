import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Academy } from '../domain/academy.entity';
import { Slug } from '../domain/value-objects/slug.vo';
import type { AcademyRepository } from '../domain/ports/academy.repository';

export interface ProvisionAcademyInput {
  /** Clerk org_id — becomes academies.id */
  orgId: string;
  name: string;
  slug: string;
}

/**
 * ProvisionAcademyUseCase — creates or updates a local academy mirror.
 *
 * Called by the Clerk webhook delivery layer for `organization.created` and
 * `organization.updated` events. Idempotent: underlying repo uses upsert.
 *
 * Authorization: only callers with `admin` role may provision.
 * For webhook-driven calls, TenantContext is synthetic:
 *   { orgId: payload.id, userId: 'system', role: 'admin' }
 */
export class ProvisionAcademyUseCase {
  constructor(private readonly academyRepo: AcademyRepository) {}

  async execute(ctx: TenantContext, input: ProvisionAcademyInput): Promise<void> {
    assertRole(ctx, ['admin']);

    const slug = Slug.create(input.slug);

    const now = new Date();
    const academy = new Academy({
      id: input.orgId,
      name: input.name,
      slug: slug.value,
      createdAt: now,
      updatedAt: now,
    });

    await this.academyRepo.upsert(ctx, academy);
  }
}

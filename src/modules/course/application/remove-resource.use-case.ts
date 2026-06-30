import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { ResourceRepository } from '../domain/ports/resource.repository';

export interface RemoveResourceInput {
  id: string;
}

/**
 * RemoveResourceUseCase
 *
 * Hard-deletes a resource by ID.
 *
 * Authorization: admin or instructor.
 */
export class RemoveResourceUseCase {
  constructor(private readonly resourceRepo: ResourceRepository) {}

  async execute(ctx: TenantContext, input: RemoveResourceInput): Promise<void> {
    assertRole(ctx, ['admin', 'instructor']);
    await this.resourceRepo.delete(ctx, input.id);
  }
}

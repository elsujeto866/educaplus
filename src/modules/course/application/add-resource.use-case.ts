import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Resource } from '../domain/resource.entity';
import type { ResourceRepository } from '../domain/ports/resource.repository';

export interface AddResourceInput {
  /** Caller-supplied UUID for the new resource. */
  id: string;
  lessonId: string;
  academyId: string;
  title: string;
  url: string;
}

/**
 * AddResourceUseCase
 *
 * Attaches a link resource to a lesson. Position is appended after existing
 * resources via the count of current resources for the lesson.
 *
 * Authorization: admin or instructor.
 */
export class AddResourceUseCase {
  constructor(private readonly resourceRepo: ResourceRepository) {}

  async execute(ctx: TenantContext, input: AddResourceInput): Promise<Resource> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.resourceRepo.findByLesson(ctx, input.lessonId);

    const resource = new Resource({
      id: input.id,
      lessonId: input.lessonId,
      academyId: input.academyId,
      type: 'link',
      title: input.title,
      url: input.url,
      position: existing.length + 1,
      createdAt: new Date(),
    });

    await this.resourceRepo.create(ctx, resource);
    return resource;
  }
}

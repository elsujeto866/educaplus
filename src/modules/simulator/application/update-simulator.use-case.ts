import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Simulator } from '../domain/simulator.entity';
import { SimulatorNotFoundError } from '../domain/errors';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';

export interface UpdateSimulatorInput {
  id: string;
  title: string;
  description?: string | null;
  questionCount: number;
  passingScore: number;
  timeLimitMinutes: number;
  attemptLimit: number;
  topicFilter?: string[] | null;
}

/**
 * UpdateSimulatorUseCase
 *
 * Edits the simulator's rule fields. `bankId` and `status` are intentionally
 * NOT part of the input — the bank binding is fixed at creation time
 * (Decision 1: exactly one bank per simulator), and status is only ever
 * changed via Publish/UnpublishSimulatorUseCase (each with their own gate).
 *
 * Authorization: admin or instructor.
 */
export class UpdateSimulatorUseCase {
  constructor(private readonly simulatorRepo: SimulatorRepository) {}

  async execute(ctx: TenantContext, input: UpdateSimulatorInput): Promise<Simulator> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.simulatorRepo.findById(ctx, input.id);
    if (!existing) throw new SimulatorNotFoundError(input.id);

    const updated = new Simulator({
      ...existing,
      title: input.title,
      description: input.description ?? null,
      questionCount: input.questionCount,
      passingScore: input.passingScore,
      timeLimitMinutes: input.timeLimitMinutes,
      attemptLimit: input.attemptLimit,
      topicFilter: input.topicFilter ?? null,
      updatedAt: new Date(),
    });

    await this.simulatorRepo.update(ctx, updated);
    return updated;
  }
}

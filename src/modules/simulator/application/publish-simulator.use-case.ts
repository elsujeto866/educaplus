import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Simulator } from '../domain/simulator.entity';
import { SimulatorNotFoundError, InsufficientQuestionPoolError } from '../domain/errors';
import { filterByTopic } from '../domain/services/question-selection.service';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';
import type { QuestionRepository } from '../domain/ports/question.repository';

export interface PublishSimulatorInput {
  id: string;
}

/**
 * PublishSimulatorUseCase
 *
 * spec.md "Bank has fewer questions than required": rejects publish when
 * the bank's matching pool (its questions filtered by the simulator's
 * topicFilter, via the SAME `filterByTopic` helper the selection engine
 * uses) is smaller than `questionCount`. This is the publish-time GATE —
 * once published, the selection engine (Slice S4) may still defensively
 * "use all available" if the bank shrinks again later, but a fresh publish
 * must never silently under-fill.
 *
 * Authorization: admin or instructor.
 */
export class PublishSimulatorUseCase {
  constructor(
    private readonly simulatorRepo: SimulatorRepository,
    private readonly questionRepo: QuestionRepository,
  ) {}

  async execute(ctx: TenantContext, input: PublishSimulatorInput): Promise<Simulator> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.simulatorRepo.findById(ctx, input.id);
    if (!existing) throw new SimulatorNotFoundError(input.id);

    const pool = await this.questionRepo.findByBank(ctx, existing.bankId);
    const matching = filterByTopic(pool, existing.topicFilter);

    if (matching.length < existing.questionCount) {
      throw new InsufficientQuestionPoolError(existing.id, matching.length, existing.questionCount);
    }

    const published = existing.publish();
    await this.simulatorRepo.update(ctx, published);
    return published;
  }
}

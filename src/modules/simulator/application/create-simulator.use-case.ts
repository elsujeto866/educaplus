import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Simulator } from '../domain/simulator.entity';
import { QuestionBankNotFoundError } from '../domain/errors';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';
import type { QuestionBankRepository } from '../domain/ports/question-bank.repository';

export interface CreateSimulatorInput {
  /** Caller-supplied UUID for the new simulator. */
  id: string;
  academyId: string;
  bankId: string;
  title: string;
  description?: string | null;
  questionCount: number;
  passingScore: number;
  timeLimitMinutes: number;
  attemptLimit: number;
  topicFilter?: string[] | null;
}

/**
 * CreateSimulatorUseCase
 *
 * Persists a new simulator bound to an existing bank, always in 'draft'
 * status (spec.md "Define simulator": "New simulators start unpublished").
 * `selectionStrategy` is hardcoded to 'random' — the only value the schema
 * enum currently supports (Decision 7); there is nothing for the caller to
 * choose yet.
 *
 * Authorization: admin or instructor.
 */
export class CreateSimulatorUseCase {
  constructor(
    private readonly simulatorRepo: SimulatorRepository,
    private readonly bankRepo: QuestionBankRepository,
  ) {}

  async execute(ctx: TenantContext, input: CreateSimulatorInput): Promise<Simulator> {
    assertRole(ctx, ['admin', 'instructor']);

    const bank = await this.bankRepo.findById(ctx, input.bankId);
    if (!bank) throw new QuestionBankNotFoundError(input.bankId);

    const now = new Date();
    const simulator = new Simulator({
      id: input.id,
      academyId: input.academyId,
      bankId: input.bankId,
      title: input.title,
      description: input.description ?? null,
      questionCount: input.questionCount,
      passingScore: input.passingScore,
      timeLimitMinutes: input.timeLimitMinutes,
      attemptLimit: input.attemptLimit,
      selectionStrategy: 'random',
      topicFilter: input.topicFilter ?? null,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });

    await this.simulatorRepo.create(ctx, simulator);
    return simulator;
  }
}

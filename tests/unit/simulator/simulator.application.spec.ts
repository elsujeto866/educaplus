/**
 * Application use-case unit tests — simulator definition + catalog (Slice S3).
 *
 * All repositories are mocked with vi.fn() — no DB, no infrastructure.
 * Mirrors `tests/unit/simulator/bank-question.application.spec.ts`'s
 * structure and fixture style.
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { UnauthorizedError } from '../../../src/shared/kernel/tenant-context';
import { CreateSimulatorUseCase } from '../../../src/modules/simulator/application/create-simulator.use-case';
import { UpdateSimulatorUseCase } from '../../../src/modules/simulator/application/update-simulator.use-case';
import { PublishSimulatorUseCase } from '../../../src/modules/simulator/application/publish-simulator.use-case';
import { UnpublishSimulatorUseCase } from '../../../src/modules/simulator/application/unpublish-simulator.use-case';
import { ListSimulatorsUseCase } from '../../../src/modules/simulator/application/list-simulators.use-case';
import { GetSimulatorUseCase } from '../../../src/modules/simulator/application/get-simulator.use-case';
import { ListPublishedSimulatorsUseCase } from '../../../src/modules/simulator/application/list-published-simulators.use-case';
import { GetPublishedSimulatorUseCase } from '../../../src/modules/simulator/application/get-published-simulator.use-case';
import { Simulator } from '../../../src/modules/simulator/domain/simulator.entity';
import { QuestionBank } from '../../../src/modules/simulator/domain/question-bank.entity';
import { Question } from '../../../src/modules/simulator/domain/question.entity';
import {
  QuestionBankNotFoundError,
  SimulatorNotFoundError,
  InsufficientQuestionPoolError,
  InvalidSimulatorError,
} from '../../../src/modules/simulator/domain/errors';
import type { SimulatorRepository } from '../../../src/modules/simulator/domain/ports/simulator.repository';
import type { QuestionBankRepository } from '../../../src/modules/simulator/domain/ports/question-bank.repository';
import type { QuestionRepository } from '../../../src/modules/simulator/domain/ports/question.repository';

const now = new Date('2025-01-01T00:00:00Z');

const adminCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'admin' };
const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_2', role: 'instructor' };
const learnerCtx: TenantContext = { orgId: 'org_A', userId: 'user_3', role: 'student' };

function makeSimulator(overrides: Partial<ConstructorParameters<typeof Simulator>[0]> = {}): Simulator {
  return new Simulator({
    id: 'sim-1',
    academyId: 'org_A',
    bankId: 'bank-1',
    title: 'Simulacro de matemática',
    description: null,
    questionCount: 3,
    passingScore: 70,
    timeLimitMinutes: 30,
    attemptLimit: 3,
    selectionStrategy: 'random',
    topicFilter: null,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeBank(overrides: Partial<ConstructorParameters<typeof QuestionBank>[0]> = {}): QuestionBank {
  return new QuestionBank({
    id: 'bank-1',
    academyId: 'org_A',
    title: 'Matemática básica',
    description: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeQuestion(overrides: Partial<ConstructorParameters<typeof Question>[0]> = {}): Question {
  return new Question({
    id: `question-${crypto.randomUUID()}`,
    bankId: 'bank-1',
    academyId: 'org_A',
    prompt: '¿Cuánto es 2+2?',
    options: [
      { id: 'opt-a', label: '3' },
      { id: 'opt-b', label: '4' },
    ],
    correctOptionId: 'opt-b',
    topic: null,
    difficulty: null,
    explanation: null,
    position: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeSimulatorRepo(overrides: Partial<SimulatorRepository> = {}): SimulatorRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findByAcademy: vi.fn(),
    findPublishedByAcademy: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeBankRepo(overrides: Partial<QuestionBankRepository> = {}): QuestionBankRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findByAcademy: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    isReferencedBySimulator: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeQuestionRepo(overrides: Partial<QuestionRepository> = {}): QuestionRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findByBank: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    countByBank: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CreateSimulatorUseCase
// ---------------------------------------------------------------------------

describe('CreateSimulatorUseCase', () => {
  it('creates a draft simulator bound to an existing bank', async () => {
    const simulatorRepo = makeSimulatorRepo();
    const bankRepo = makeBankRepo({ findById: vi.fn().mockResolvedValue(makeBank()) });
    const useCase = new CreateSimulatorUseCase(simulatorRepo, bankRepo);

    const sim = await useCase.execute(adminCtx, {
      id: 'sim-new',
      academyId: 'org_A',
      bankId: 'bank-1',
      title: 'Simulacro final',
      questionCount: 5,
      passingScore: 60,
      timeLimitMinutes: 20,
      attemptLimit: 2,
      topicFilter: null,
    });

    expect(sim.status).toBe('draft');
    expect(sim.bankId).toBe('bank-1');
    expect(simulatorRepo.create).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ id: 'sim-new' }));
  });

  it('allows instructor to create a simulator', async () => {
    const simulatorRepo = makeSimulatorRepo();
    const bankRepo = makeBankRepo({ findById: vi.fn().mockResolvedValue(makeBank()) });
    const useCase = new CreateSimulatorUseCase(simulatorRepo, bankRepo);

    const sim = await useCase.execute(instructorCtx, {
      id: 'sim-2',
      academyId: 'org_A',
      bankId: 'bank-1',
      title: 'Simulacro 2',
      questionCount: 5,
      passingScore: 60,
      timeLimitMinutes: 20,
      attemptLimit: 2,
      topicFilter: null,
    });

    expect(sim.title).toBe('Simulacro 2');
  });

  it('throws UnauthorizedError when role is student', async () => {
    const simulatorRepo = makeSimulatorRepo();
    const bankRepo = makeBankRepo({ findById: vi.fn().mockResolvedValue(makeBank()) });
    const useCase = new CreateSimulatorUseCase(simulatorRepo, bankRepo);

    await expect(
      useCase.execute(learnerCtx, {
        id: 'sim-3',
        academyId: 'org_A',
        bankId: 'bank-1',
        title: 'Simulacro 3',
        questionCount: 5,
        passingScore: 60,
        timeLimitMinutes: 20,
        attemptLimit: 2,
        topicFilter: null,
      }),
    ).rejects.toThrow(UnauthorizedError);
    expect(simulatorRepo.create).not.toHaveBeenCalled();
  });

  it('throws QuestionBankNotFoundError when the bank does not exist (or belongs to another tenant)', async () => {
    const simulatorRepo = makeSimulatorRepo();
    const bankRepo = makeBankRepo({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new CreateSimulatorUseCase(simulatorRepo, bankRepo);

    await expect(
      useCase.execute(adminCtx, {
        id: 'sim-4',
        academyId: 'org_A',
        bankId: 'missing-bank',
        title: 'Simulacro 4',
        questionCount: 5,
        passingScore: 60,
        timeLimitMinutes: 20,
        attemptLimit: 2,
        topicFilter: null,
      }),
    ).rejects.toThrow(QuestionBankNotFoundError);
    expect(simulatorRepo.create).not.toHaveBeenCalled();
  });

  it('propagates InvalidSimulatorError from the entity for a bad questionCount', async () => {
    const simulatorRepo = makeSimulatorRepo();
    const bankRepo = makeBankRepo({ findById: vi.fn().mockResolvedValue(makeBank()) });
    const useCase = new CreateSimulatorUseCase(simulatorRepo, bankRepo);

    await expect(
      useCase.execute(adminCtx, {
        id: 'sim-5',
        academyId: 'org_A',
        bankId: 'bank-1',
        title: 'Simulacro 5',
        questionCount: 0,
        passingScore: 60,
        timeLimitMinutes: 20,
        attemptLimit: 2,
        topicFilter: null,
      }),
    ).rejects.toThrow(InvalidSimulatorError);
  });
});

// ---------------------------------------------------------------------------
// UpdateSimulatorUseCase
// ---------------------------------------------------------------------------

describe('UpdateSimulatorUseCase', () => {
  it('updates rule fields and preserves bankId/status', async () => {
    const existing = makeSimulator({ title: 'Original', questionCount: 3 });
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(existing) });
    const useCase = new UpdateSimulatorUseCase(simulatorRepo);

    const updated = await useCase.execute(adminCtx, {
      id: 'sim-1',
      title: 'Actualizado',
      description: 'Nueva descripción',
      questionCount: 8,
      passingScore: 80,
      timeLimitMinutes: 45,
      attemptLimit: 5,
      topicFilter: ['algebra'],
    });

    expect(updated.title).toBe('Actualizado');
    expect(updated.questionCount).toBe(8);
    expect(updated.bankId).toBe('bank-1');
    expect(updated.status).toBe('draft');
    expect(simulatorRepo.update).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ title: 'Actualizado' }));
  });

  it('throws SimulatorNotFoundError when the simulator does not exist', async () => {
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new UpdateSimulatorUseCase(simulatorRepo);

    await expect(
      useCase.execute(adminCtx, {
        id: 'missing',
        title: 'X',
        description: null,
        questionCount: 5,
        passingScore: 60,
        timeLimitMinutes: 20,
        attemptLimit: 2,
        topicFilter: null,
      }),
    ).rejects.toThrow(SimulatorNotFoundError);
  });

  it('throws UnauthorizedError when role is student', async () => {
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(makeSimulator()) });
    const useCase = new UpdateSimulatorUseCase(simulatorRepo);

    await expect(
      useCase.execute(learnerCtx, {
        id: 'sim-1',
        title: 'X',
        description: null,
        questionCount: 5,
        passingScore: 60,
        timeLimitMinutes: 20,
        attemptLimit: 2,
        topicFilter: null,
      }),
    ).rejects.toThrow(UnauthorizedError);
    expect(simulatorRepo.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PublishSimulatorUseCase
// ---------------------------------------------------------------------------

describe('PublishSimulatorUseCase', () => {
  it('publishes when the bank pool has enough matching questions', async () => {
    const existing = makeSimulator({ questionCount: 2, topicFilter: null });
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(existing) });
    const questionRepo = makeQuestionRepo({
      findByBank: vi.fn().mockResolvedValue([makeQuestion(), makeQuestion(), makeQuestion()]),
    });
    const useCase = new PublishSimulatorUseCase(simulatorRepo, questionRepo);

    const published = await useCase.execute(adminCtx, { id: 'sim-1' });

    expect(published.status).toBe('published');
    expect(simulatorRepo.update).toHaveBeenCalledWith(
      adminCtx,
      expect.objectContaining({ status: 'published' }),
    );
  });

  it('rejects publish when the bank pool is smaller than questionCount (spec.md)', async () => {
    const existing = makeSimulator({ questionCount: 5, topicFilter: null });
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(existing) });
    const questionRepo = makeQuestionRepo({
      findByBank: vi.fn().mockResolvedValue([makeQuestion(), makeQuestion()]),
    });
    const useCase = new PublishSimulatorUseCase(simulatorRepo, questionRepo);

    await expect(useCase.execute(adminCtx, { id: 'sim-1' })).rejects.toThrow(InsufficientQuestionPoolError);
    expect(simulatorRepo.update).not.toHaveBeenCalled();
  });

  it('applies topicFilter before checking the pool size', async () => {
    const existing = makeSimulator({ questionCount: 2, topicFilter: ['algebra'] });
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(existing) });
    const questionRepo = makeQuestionRepo({
      findByBank: vi.fn().mockResolvedValue([
        makeQuestion({ topic: 'algebra' }),
        makeQuestion({ topic: 'geometria' }),
        makeQuestion({ topic: 'geometria' }),
      ]),
    });
    const useCase = new PublishSimulatorUseCase(simulatorRepo, questionRepo);

    // Only 1 'algebra' question exists, but 2 are required → must reject
    // even though the RAW pool (3) would have been enough.
    await expect(useCase.execute(adminCtx, { id: 'sim-1' })).rejects.toThrow(InsufficientQuestionPoolError);
  });

  it('throws SimulatorNotFoundError when the simulator does not exist', async () => {
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(null) });
    const questionRepo = makeQuestionRepo();
    const useCase = new PublishSimulatorUseCase(simulatorRepo, questionRepo);

    await expect(useCase.execute(adminCtx, { id: 'missing' })).rejects.toThrow(SimulatorNotFoundError);
  });

  it('throws UnauthorizedError when role is student', async () => {
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(makeSimulator()) });
    const questionRepo = makeQuestionRepo({ findByBank: vi.fn().mockResolvedValue([makeQuestion(), makeQuestion(), makeQuestion()]) });
    const useCase = new PublishSimulatorUseCase(simulatorRepo, questionRepo);

    await expect(useCase.execute(learnerCtx, { id: 'sim-1' })).rejects.toThrow(UnauthorizedError);
    expect(simulatorRepo.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// UnpublishSimulatorUseCase
// ---------------------------------------------------------------------------

describe('UnpublishSimulatorUseCase', () => {
  it('sets status back to draft', async () => {
    const existing = makeSimulator({ status: 'published' });
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(existing) });
    const useCase = new UnpublishSimulatorUseCase(simulatorRepo);

    const result = await useCase.execute(adminCtx, { id: 'sim-1' });

    expect(result.status).toBe('draft');
  });

  it('throws SimulatorNotFoundError when the simulator does not exist', async () => {
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new UnpublishSimulatorUseCase(simulatorRepo);

    await expect(useCase.execute(adminCtx, { id: 'missing' })).rejects.toThrow(SimulatorNotFoundError);
  });

  it('throws UnauthorizedError when role is student', async () => {
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(makeSimulator({ status: 'published' })) });
    const useCase = new UnpublishSimulatorUseCase(simulatorRepo);

    await expect(useCase.execute(learnerCtx, { id: 'sim-1' })).rejects.toThrow(UnauthorizedError);
  });
});

// ---------------------------------------------------------------------------
// ListSimulatorsUseCase / GetSimulatorUseCase (admin, read-only)
// ---------------------------------------------------------------------------

describe('ListSimulatorsUseCase', () => {
  it('returns all simulators for the tenant academy', async () => {
    const simulators = [makeSimulator({ id: 'a' }), makeSimulator({ id: 'b' })];
    const simulatorRepo = makeSimulatorRepo({ findByAcademy: vi.fn().mockResolvedValue(simulators) });
    const useCase = new ListSimulatorsUseCase(simulatorRepo);

    const result = await useCase.execute(adminCtx);

    expect(result).toEqual(simulators);
    expect(simulatorRepo.findByAcademy).toHaveBeenCalledWith(adminCtx, 'org_A');
  });
});

describe('GetSimulatorUseCase', () => {
  it('returns the simulator by id', async () => {
    const sim = makeSimulator();
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(sim) });
    const useCase = new GetSimulatorUseCase(simulatorRepo);

    expect(await useCase.execute(adminCtx, 'sim-1')).toBe(sim);
  });

  it('returns null when not found (or cross-tenant)', async () => {
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new GetSimulatorUseCase(simulatorRepo);

    expect(await useCase.execute(adminCtx, 'missing')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ListPublishedSimulatorsUseCase / GetPublishedSimulatorUseCase (student catalog)
// ---------------------------------------------------------------------------

describe('ListPublishedSimulatorsUseCase', () => {
  it('returns only published simulators, no role check required', async () => {
    const simulators = [makeSimulator({ id: 'a', status: 'published' })];
    const simulatorRepo = makeSimulatorRepo({ findPublishedByAcademy: vi.fn().mockResolvedValue(simulators) });
    const useCase = new ListPublishedSimulatorsUseCase(simulatorRepo);

    const result = await useCase.execute(learnerCtx);

    expect(result).toEqual(simulators);
    expect(simulatorRepo.findPublishedByAcademy).toHaveBeenCalledWith(learnerCtx, 'org_A');
  });
});

describe('GetPublishedSimulatorUseCase', () => {
  it('returns the simulator when it exists and is published', async () => {
    const sim = makeSimulator({ status: 'published' });
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(sim) });
    const useCase = new GetPublishedSimulatorUseCase(simulatorRepo);

    expect(await useCase.execute(learnerCtx, 'sim-1')).toBe(sim);
  });

  it('returns null when the simulator is a draft (spec.md "Unpublished stays hidden")', async () => {
    const sim = makeSimulator({ status: 'draft' });
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(sim) });
    const useCase = new GetPublishedSimulatorUseCase(simulatorRepo);

    expect(await useCase.execute(learnerCtx, 'sim-1')).toBeNull();
  });

  it('returns null when the simulator does not exist (or cross-tenant)', async () => {
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new GetPublishedSimulatorUseCase(simulatorRepo);

    expect(await useCase.execute(learnerCtx, 'missing')).toBeNull();
  });
});

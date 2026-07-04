/**
 * Application use-case unit tests — simulator bank authoring (Slice S2).
 *
 * All repositories are mocked with vi.fn() — no DB, no infrastructure.
 * Mirrors `tests/unit/course/course.application.spec.ts`'s structure and
 * fixture style.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { UnauthorizedError } from '../../../src/shared/kernel/tenant-context';
import { CreateBankUseCase } from '../../../src/modules/simulator/application/create-bank.use-case';
import { UpdateBankUseCase } from '../../../src/modules/simulator/application/update-bank.use-case';
import { DeleteBankUseCase } from '../../../src/modules/simulator/application/delete-bank.use-case';
import { ListBanksUseCase } from '../../../src/modules/simulator/application/list-banks.use-case';
import { GetBankDetailUseCase } from '../../../src/modules/simulator/application/get-bank-detail.use-case';
import { AddQuestionUseCase } from '../../../src/modules/simulator/application/add-question.use-case';
import { UpdateQuestionUseCase } from '../../../src/modules/simulator/application/update-question.use-case';
import { DeleteQuestionUseCase } from '../../../src/modules/simulator/application/delete-question.use-case';
import { QuestionBank } from '../../../src/modules/simulator/domain/question-bank.entity';
import { Question } from '../../../src/modules/simulator/domain/question.entity';
import {
  QuestionBankNotFoundError,
  QuestionBankInUseError,
  QuestionNotFoundError,
  InvalidQuestionError,
} from '../../../src/modules/simulator/domain/errors';
import type { QuestionBankRepository } from '../../../src/modules/simulator/domain/ports/question-bank.repository';
import type { QuestionRepository } from '../../../src/modules/simulator/domain/ports/question.repository';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const now = new Date('2025-01-01T00:00:00Z');

const adminCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'admin' };
const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_2', role: 'instructor' };
const learnerCtx: TenantContext = { orgId: 'org_A', userId: 'user_3', role: 'student' };

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
    id: 'question-1',
    bankId: 'bank-1',
    academyId: 'org_A',
    prompt: '¿Cuánto es 2+2?',
    options: [
      { id: 'opt-a', label: '3' },
      { id: 'opt-b', label: '4' },
    ],
    correctOptionId: 'opt-b',
    topic: 'aritmética',
    difficulty: 'easy',
    explanation: null,
    position: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
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
    findByBank: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    countByBank: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. CreateBankUseCase
// ---------------------------------------------------------------------------

describe('CreateBankUseCase', () => {
  it('creates a bank scoped to the caller academy', async () => {
    const bankRepo = makeBankRepo();
    const useCase = new CreateBankUseCase(bankRepo);

    const bank = await useCase.execute(adminCtx, {
      id: 'bank-new',
      academyId: 'org_A',
      title: 'Historia argentina',
      description: 'Banco de preguntas de historia',
    });

    expect(bank.academyId).toBe('org_A');
    expect(bank.title).toBe('Historia argentina');
    expect(bankRepo.create).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ id: 'bank-new' }));
  });

  it('allows instructor to create a bank', async () => {
    const bankRepo = makeBankRepo();
    const useCase = new CreateBankUseCase(bankRepo);

    const bank = await useCase.execute(instructorCtx, {
      id: 'bank-2',
      academyId: 'org_A',
      title: 'Geografía',
    });

    expect(bank.description).toBeNull();
  });

  it('throws UnauthorizedError when role is student', async () => {
    const bankRepo = makeBankRepo();
    const useCase = new CreateBankUseCase(bankRepo);

    await expect(
      useCase.execute(learnerCtx, { id: 'bank-3', academyId: 'org_A', title: 'Ciencias' }),
    ).rejects.toThrow(UnauthorizedError);
    expect(bankRepo.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. UpdateBankUseCase
// ---------------------------------------------------------------------------

describe('UpdateBankUseCase', () => {
  it('renames the title and preserves the description when omitted', async () => {
    const bankRepo = makeBankRepo({ findById: vi.fn().mockResolvedValue(makeBank({ description: 'Original' })) });
    const useCase = new UpdateBankUseCase(bankRepo);

    const updated = await useCase.execute(adminCtx, { id: 'bank-1', title: 'Matemática avanzada' });

    expect(updated.title).toBe('Matemática avanzada');
    expect(updated.description).toBe('Original');
    expect(bankRepo.update).toHaveBeenCalledOnce();
  });

  it('throws QuestionBankNotFoundError when the bank does not exist', async () => {
    const bankRepo = makeBankRepo({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new UpdateBankUseCase(bankRepo);

    await expect(useCase.execute(adminCtx, { id: 'missing', title: 'X' })).rejects.toThrow(
      QuestionBankNotFoundError,
    );
  });
});

// ---------------------------------------------------------------------------
// 3. DeleteBankUseCase — reject when referenced by a simulator
// ---------------------------------------------------------------------------

describe('DeleteBankUseCase', () => {
  it('throws QuestionBankInUseError when the bank is bound to a simulator', async () => {
    const bankRepo = makeBankRepo({ isReferencedBySimulator: vi.fn().mockResolvedValue(true) });
    const useCase = new DeleteBankUseCase(bankRepo);

    await expect(useCase.execute(adminCtx, { id: 'bank-1' })).rejects.toThrow(QuestionBankInUseError);
    expect(bankRepo.delete).not.toHaveBeenCalled();
  });

  it('deletes the bank when it is not referenced by any simulator', async () => {
    const bankRepo = makeBankRepo({ isReferencedBySimulator: vi.fn().mockResolvedValue(false) });
    const useCase = new DeleteBankUseCase(bankRepo);

    await useCase.execute(adminCtx, { id: 'bank-1' });

    expect(bankRepo.delete).toHaveBeenCalledWith(adminCtx, 'bank-1');
  });

  it('throws UnauthorizedError when role is student', async () => {
    const bankRepo = makeBankRepo();
    const useCase = new DeleteBankUseCase(bankRepo);

    await expect(useCase.execute(learnerCtx, { id: 'bank-1' })).rejects.toThrow(UnauthorizedError);
  });
});

// ---------------------------------------------------------------------------
// 4. ListBanksUseCase / GetBankDetailUseCase — read models
// ---------------------------------------------------------------------------

describe('ListBanksUseCase', () => {
  it('returns banks scoped to ctx.orgId', async () => {
    const banks = [makeBank({ id: 'bank-1' }), makeBank({ id: 'bank-2' })];
    const bankRepo = makeBankRepo({ findByAcademy: vi.fn().mockResolvedValue(banks) });
    const useCase = new ListBanksUseCase(bankRepo);

    const result = await useCase.execute(adminCtx);

    expect(result).toHaveLength(2);
    expect(bankRepo.findByAcademy).toHaveBeenCalledWith(adminCtx, 'org_A');
  });
});

describe('GetBankDetailUseCase', () => {
  it('returns null when the bank does not exist (or belongs to another tenant)', async () => {
    const bankRepo = makeBankRepo({ findById: vi.fn().mockResolvedValue(null) });
    const questionRepo = makeQuestionRepo();
    const useCase = new GetBankDetailUseCase(bankRepo, questionRepo);

    const result = await useCase.execute(adminCtx, 'missing');

    expect(result).toBeNull();
    expect(questionRepo.findByBank).not.toHaveBeenCalled();
  });

  it('returns the bank with its ordered questions', async () => {
    const bank = makeBank();
    const questions = [makeQuestion({ id: 'q-1', position: 1 }), makeQuestion({ id: 'q-2', position: 2 })];
    const bankRepo = makeBankRepo({ findById: vi.fn().mockResolvedValue(bank) });
    const questionRepo = makeQuestionRepo({ findByBank: vi.fn().mockResolvedValue(questions) });
    const useCase = new GetBankDetailUseCase(bankRepo, questionRepo);

    const result = await useCase.execute(adminCtx, 'bank-1');

    expect(result?.bank.id).toBe('bank-1');
    expect(result?.questions).toHaveLength(2);
    expect(questionRepo.findByBank).toHaveBeenCalledWith(adminCtx, 'bank-1');
  });
});

// ---------------------------------------------------------------------------
// 5. AddQuestionUseCase — position = count + 1, reject missing correct answer
// ---------------------------------------------------------------------------

describe('AddQuestionUseCase', () => {
  it('assigns position = count + 1', async () => {
    const questionRepo = makeQuestionRepo({ countByBank: vi.fn().mockResolvedValue(3) });
    const useCase = new AddQuestionUseCase(questionRepo);

    const question = await useCase.execute(adminCtx, {
      id: 'question-new',
      bankId: 'bank-1',
      academyId: 'org_A',
      prompt: '¿Capital de Francia?',
      options: [
        { id: 'opt-a', label: 'Madrid' },
        { id: 'opt-b', label: 'París' },
      ],
      correctOptionId: 'opt-b',
      topic: 'geografía',
      difficulty: 'medium',
    });

    expect(question.position).toBe(4);
    expect(questionRepo.create).toHaveBeenCalledOnce();
  });

  it('rejects a correctOptionId that does not match any option', async () => {
    const questionRepo = makeQuestionRepo();
    const useCase = new AddQuestionUseCase(questionRepo);

    await expect(
      useCase.execute(adminCtx, {
        id: 'question-bad',
        bankId: 'bank-1',
        academyId: 'org_A',
        prompt: 'Pregunta sin respuesta correcta',
        options: [
          { id: 'opt-a', label: 'A' },
          { id: 'opt-b', label: 'B' },
        ],
        correctOptionId: 'opt-nonexistent',
      }),
    ).rejects.toThrow(InvalidQuestionError);
    expect(questionRepo.create).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when role is student', async () => {
    const questionRepo = makeQuestionRepo();
    const useCase = new AddQuestionUseCase(questionRepo);

    await expect(
      useCase.execute(learnerCtx, {
        id: 'question-x',
        bankId: 'bank-1',
        academyId: 'org_A',
        prompt: 'Pregunta',
        options: [
          { id: 'opt-a', label: 'A' },
          { id: 'opt-b', label: 'B' },
        ],
        correctOptionId: 'opt-a',
      }),
    ).rejects.toThrow(UnauthorizedError);
  });
});

// ---------------------------------------------------------------------------
// 6. UpdateQuestionUseCase
// ---------------------------------------------------------------------------

describe('UpdateQuestionUseCase', () => {
  it('updates the prompt and preserves options when omitted', async () => {
    const existing = makeQuestion();
    const questionRepo = makeQuestionRepo({ findById: vi.fn().mockResolvedValue(existing) });
    const useCase = new UpdateQuestionUseCase(questionRepo);

    const updated = await useCase.execute(adminCtx, { id: 'question-1', prompt: '¿Cuánto es 3+3?' });

    expect(updated.prompt).toBe('¿Cuánto es 3+3?');
    expect(updated.options).toHaveLength(2);
    expect(questionRepo.update).toHaveBeenCalledOnce();
  });

  it('throws QuestionNotFoundError when the question does not exist', async () => {
    const questionRepo = makeQuestionRepo({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new UpdateQuestionUseCase(questionRepo);

    await expect(useCase.execute(adminCtx, { id: 'missing', prompt: 'X' })).rejects.toThrow(
      QuestionNotFoundError,
    );
  });

  it('rejects updating correctOptionId to a value outside the (possibly new) options', async () => {
    const existing = makeQuestion();
    const questionRepo = makeQuestionRepo({ findById: vi.fn().mockResolvedValue(existing) });
    const useCase = new UpdateQuestionUseCase(questionRepo);

    await expect(
      useCase.execute(adminCtx, { id: 'question-1', correctOptionId: 'opt-nonexistent' }),
    ).rejects.toThrow(InvalidQuestionError);
  });
});

// ---------------------------------------------------------------------------
// 7. DeleteQuestionUseCase
// ---------------------------------------------------------------------------

describe('DeleteQuestionUseCase', () => {
  it('calls repo.delete with the given id', async () => {
    const questionRepo = makeQuestionRepo();
    const useCase = new DeleteQuestionUseCase(questionRepo);

    await useCase.execute(adminCtx, { id: 'question-1' });

    expect(questionRepo.delete).toHaveBeenCalledWith(adminCtx, 'question-1');
  });

  it('throws UnauthorizedError when role is student', async () => {
    const questionRepo = makeQuestionRepo();
    const useCase = new DeleteQuestionUseCase(questionRepo);

    await expect(useCase.execute(learnerCtx, { id: 'question-1' })).rejects.toThrow(UnauthorizedError);
    expect(questionRepo.delete).not.toHaveBeenCalled();
  });
});

/**
 * ImportQuestionsFromCsvUseCase unit tests — fake `QuestionRepository` and a
 * fake `CsvQuestionSource` (vi.fn()-based), no DB, no real CSV parsing.
 * Feeding a fake `CsvQuestionSource.parse()` directly lets these tests
 * exercise the SKIP-INVALID report shape with structurally-invalid rows
 * (duplicate option ids, dangling correctOptionId, etc) that a real RFC-4180
 * file could never produce on its own (option ids always come from fixed,
 * inherently-unique column letters a-d) — the use-case must still handle
 * them defensively since the port contract allows any shape.
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { UnauthorizedError } from '../../../src/shared/kernel/tenant-context';
import { ImportQuestionsFromCsvUseCase } from '../../../src/modules/simulator/application/import-questions-from-csv.use-case';
import type { QuestionRepository } from '../../../src/modules/simulator/domain/ports/question.repository';
import type { QuestionBankRepository } from '../../../src/modules/simulator/domain/ports/question-bank.repository';
import { QuestionBank } from '../../../src/modules/simulator/domain/question-bank.entity';
import { QuestionBankNotFoundError } from '../../../src/modules/simulator/domain/errors';
import type {
  CsvQuestionSource,
  ParsedCsvQuestion,
} from '../../../src/modules/simulator/domain/ports/csv-question-source.port';

const adminCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'admin' };
const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_2', role: 'instructor' };
const learnerCtx: TenantContext = { orgId: 'org_A', userId: 'user_3', role: 'student' };

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

const existingBank = new QuestionBank({
  id: 'bank-1',
  academyId: 'org_A',
  title: 'Existing bank',
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeBankRepo(overrides: Partial<QuestionBankRepository> = {}): QuestionBankRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(existingBank),
    findByAcademy: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    isReferencedBySimulator: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeParsedRow(overrides: Partial<ParsedCsvQuestion> = {}): ParsedCsvQuestion {
  return {
    rowNumber: 2,
    prompt: '¿Cuánto es 2+2?',
    options: [
      { id: 'a', label: '3' },
      { id: 'b', label: '4' },
    ],
    correctOptionId: 'b',
    topic: 'aritmética',
    difficulty: 'easy',
    explanation: null,
    ...overrides,
  };
}

function makeCsvSource(rows: ParsedCsvQuestion[]): CsvQuestionSource {
  return { parse: vi.fn().mockReturnValue(rows) };
}

describe('ImportQuestionsFromCsvUseCase', () => {
  it('imports all valid rows, positioned after the bank existing questions', async () => {
    const rows = [
      makeParsedRow({ rowNumber: 2, prompt: 'P1' }),
      makeParsedRow({ rowNumber: 3, prompt: 'P2' }),
    ];
    const questionRepo = makeQuestionRepo({ countByBank: vi.fn().mockResolvedValue(5) });
    const csvSource = makeCsvSource(rows);
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, csvSource, makeBankRepo());

    const report = await useCase.execute(adminCtx, {
      bankId: 'bank-1',
      academyId: 'org_A',
      content: 'irrelevant — csvSource is faked',
      ids: ['q-1', 'q-2'],
    });

    expect(report).toEqual({ imported: 2, skipped: [] });
    expect(questionRepo.create).toHaveBeenCalledTimes(2);
    const firstCall = (questionRepo.create as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    const secondCall = (questionRepo.create as ReturnType<typeof vi.fn>).mock.calls[1]![1];
    expect(firstCall.position).toBe(6);
    expect(secondCall.position).toBe(7);
  });

  it('allows instructor to import questions', async () => {
    const questionRepo = makeQuestionRepo();
    const csvSource = makeCsvSource([makeParsedRow()]);
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, csvSource, makeBankRepo());

    const report = await useCase.execute(instructorCtx, {
      bankId: 'bank-1',
      academyId: 'org_A',
      content: '',
      ids: ['q-1'],
    });

    expect(report.imported).toBe(1);
  });

  it('throws UnauthorizedError when role is student, and parses/persists nothing', async () => {
    const questionRepo = makeQuestionRepo();
    const csvSource = makeCsvSource([makeParsedRow()]);
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, csvSource, makeBankRepo());

    await expect(
      useCase.execute(learnerCtx, { bankId: 'bank-1', academyId: 'org_A', content: '', ids: ['q-1'] }),
    ).rejects.toThrow(UnauthorizedError);
    expect(questionRepo.create).not.toHaveBeenCalled();
  });

  it('returns imported:0, skipped:[] for an empty/header-only file', async () => {
    const questionRepo = makeQuestionRepo();
    const csvSource = makeCsvSource([]);
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, csvSource, makeBankRepo());

    const report = await useCase.execute(adminCtx, {
      bankId: 'bank-1',
      academyId: 'org_A',
      content: '',
      ids: [],
    });

    expect(report).toEqual({ imported: 0, skipped: [] });
    expect(questionRepo.create).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // Skip-invalid report — each invalid row is skipped with a reason, valid
  // rows around it still import.
  // ---------------------------------------------------------------------

  it('skips a row with a blank prompt', async () => {
    const rows = [makeParsedRow({ rowNumber: 2, prompt: '' })];
    const questionRepo = makeQuestionRepo();
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, makeCsvSource(rows), makeBankRepo());

    const report = await useCase.execute(adminCtx, {
      bankId: 'bank-1',
      academyId: 'org_A',
      content: '',
      ids: ['q-1'],
    });

    expect(report.imported).toBe(0);
    expect(report.skipped).toEqual([{ row: 2, reason: expect.stringContaining('prompt') }]);
  });

  it('skips a row with fewer than 2 options', async () => {
    const rows = [makeParsedRow({ rowNumber: 3, options: [{ id: 'a', label: 'Only one' }] })];
    const questionRepo = makeQuestionRepo();
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, makeCsvSource(rows), makeBankRepo());

    const report = await useCase.execute(adminCtx, {
      bankId: 'bank-1',
      academyId: 'org_A',
      content: '',
      ids: ['q-1'],
    });

    expect(report.imported).toBe(0);
    expect(report.skipped).toEqual([{ row: 3, reason: expect.stringContaining('at least 2 options') }]);
  });

  it('skips a row whose correct_option does not match any parsed option', async () => {
    const rows = [makeParsedRow({ rowNumber: 4, correctOptionId: 'z' })];
    const questionRepo = makeQuestionRepo();
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, makeCsvSource(rows), makeBankRepo());

    const report = await useCase.execute(adminCtx, {
      bankId: 'bank-1',
      academyId: 'org_A',
      content: '',
      ids: ['q-1'],
    });

    expect(report.imported).toBe(0);
    expect(report.skipped).toEqual([
      { row: 4, reason: expect.stringContaining('does not match any option') },
    ]);
  });

  it('skips a row with duplicate option ids', async () => {
    const rows = [
      makeParsedRow({
        rowNumber: 5,
        options: [
          { id: 'a', label: 'First' },
          { id: 'a', label: 'Duplicate id' },
        ],
        correctOptionId: 'a',
      }),
    ];
    const questionRepo = makeQuestionRepo();
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, makeCsvSource(rows), makeBankRepo());

    const report = await useCase.execute(adminCtx, {
      bankId: 'bank-1',
      academyId: 'org_A',
      content: '',
      ids: ['q-1'],
    });

    expect(report.imported).toBe(0);
    expect(report.skipped).toEqual([{ row: 5, reason: expect.stringContaining('unique') }]);
  });

  it('skips a row with an invalid difficulty', async () => {
    const rows = [makeParsedRow({ rowNumber: 6, difficulty: 'impossible' })];
    const questionRepo = makeQuestionRepo();
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, makeCsvSource(rows), makeBankRepo());

    const report = await useCase.execute(adminCtx, {
      bankId: 'bank-1',
      academyId: 'org_A',
      content: '',
      ids: ['q-1'],
    });

    expect(report.imported).toBe(0);
    expect(report.skipped).toEqual([
      { row: 6, reason: expect.stringContaining('Invalid difficulty') },
    ]);
  });

  it('imports valid rows and skips invalid rows in the same file, reporting both', async () => {
    const rows = [
      makeParsedRow({ rowNumber: 2, prompt: 'Valid row' }),
      makeParsedRow({ rowNumber: 3, prompt: '' }),
      makeParsedRow({ rowNumber: 4, prompt: 'Another valid row' }),
      makeParsedRow({ rowNumber: 5, options: [{ id: 'a', label: 'Only one' }] }),
    ];
    const questionRepo = makeQuestionRepo({ countByBank: vi.fn().mockResolvedValue(0) });
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, makeCsvSource(rows), makeBankRepo());

    const report = await useCase.execute(adminCtx, {
      bankId: 'bank-1',
      academyId: 'org_A',
      content: '',
      ids: ['q-1', 'q-2', 'q-3', 'q-4'],
    });

    expect(report.imported).toBe(2);
    expect(report.skipped).toHaveLength(2);
    expect(report.skipped.map((s) => s.row)).toEqual([3, 5]);
    expect(questionRepo.create).toHaveBeenCalledTimes(2);
  });

  it('skips a row with no corresponding id supplied, without crashing', async () => {
    const rows = [makeParsedRow({ rowNumber: 2 })];
    const questionRepo = makeQuestionRepo();
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, makeCsvSource(rows), makeBankRepo());

    const report = await useCase.execute(adminCtx, {
      bankId: 'bank-1',
      academyId: 'org_A',
      content: '',
      ids: [],
    });

    expect(report.imported).toBe(0);
    expect(report.skipped).toEqual([{ row: 2, reason: expect.stringContaining('id') }]);
    expect(questionRepo.create).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // bankId ownership/existence guard — a bad or foreign bankId must fail
  // fast with a clear domain error instead of silently skipping every row
  // (or, worse, creating dangling-FK questions).
  // ---------------------------------------------------------------------

  it('throws QuestionBankNotFoundError when bankId does not resolve for this tenant, and parses/persists nothing', async () => {
    const questionRepo = makeQuestionRepo();
    const csvSource = makeCsvSource([makeParsedRow()]);
    const bankRepo = makeBankRepo({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new ImportQuestionsFromCsvUseCase(questionRepo, csvSource, bankRepo);

    await expect(
      useCase.execute(adminCtx, {
        bankId: 'unknown-bank',
        academyId: 'org_A',
        content: '',
        ids: ['q-1'],
      }),
    ).rejects.toThrow(QuestionBankNotFoundError);
    expect(csvSource.parse).not.toHaveBeenCalled();
    expect(questionRepo.create).not.toHaveBeenCalled();
  });
});

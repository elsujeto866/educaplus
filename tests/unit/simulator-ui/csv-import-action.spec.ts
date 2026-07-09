/**
 * CSV question import Server Action unit tests — importQuestionsFromCsvAction.
 * Mirrors `bank-actions.spec.ts` mocking strategy (composition, next/cache
 * mocked). Phase 1 fallback: CSV content travels as pasted text (no
 * established file-upload precedent in this app — see the action's doc
 * comment), so the schema validates a non-blank `csvContent` string field.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { CsvImportActionResult } from '../../../src/app/dashboard/simulators/banks/[bankId]/csv-import-action';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const importQuestionsFromCsvExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    importQuestionsFromCsv: { execute: importQuestionsFromCsvExecuteMock },
  }),
}));

const revalidatePathMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'instructor' };
const bankId = 'bank-1';

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const initialState: CsvImportActionResult = { ok: true, imported: 0, skipped: [] };

beforeEach(() => {
  getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
  importQuestionsFromCsvExecuteMock.mockReset();
  revalidatePathMock.mockClear();
});

describe('importQuestionsFromCsvAction', () => {
  it('rejects blank csvContent WITHOUT calling getTenantContext', async () => {
    const { importQuestionsFromCsvAction } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/csv-import-action'
    );

    const result = await importQuestionsFromCsvAction(bankId, initialState, formDataWith({ csvContent: '  ' }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getTenantContextMock).not.toHaveBeenCalled();
    expect(importQuestionsFromCsvExecuteMock).not.toHaveBeenCalled();
  });

  it('imports, revalidates the bank page, and returns the imported/skipped report', async () => {
    importQuestionsFromCsvExecuteMock.mockResolvedValue({
      imported: 2,
      skipped: [{ row: 3, reason: 'prompt is required' }],
    });
    const { importQuestionsFromCsvAction } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/csv-import-action'
    );

    const csvContent = 'prompt,option_a,option_b,correct_option\nP1,a,b,a\n,,,\nP2,a,b,b';
    const result = await importQuestionsFromCsvAction(bankId, initialState, formDataWith({ csvContent }));

    expect(result).toEqual({ ok: true, imported: 2, skipped: [{ row: 3, reason: 'prompt is required' }] });
    expect(importQuestionsFromCsvExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({ bankId, academyId: instructorCtx.orgId, content: csvContent }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/simulators/banks/${bankId}`);
  });

  it('generates one caller-supplied id per non-blank physical line (at least covers every parsed row)', async () => {
    importQuestionsFromCsvExecuteMock.mockResolvedValue({ imported: 0, skipped: [] });
    const { importQuestionsFromCsvAction } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/csv-import-action'
    );

    const csvContent = 'header\nrow1\nrow2\nrow3';
    await importQuestionsFromCsvAction(bankId, initialState, formDataWith({ csvContent }));

    const call = importQuestionsFromCsvExecuteMock.mock.calls[0]![1] as { ids: string[] };
    expect(call.ids.length).toBeGreaterThanOrEqual(3);
    expect(new Set(call.ids).size).toBe(call.ids.length);
  });

  it('maps QuestionBankNotFoundError to a Spanish ActionResult', async () => {
    const notFound = new Error('Question bank "bank-1" does not exist');
    notFound.name = 'QuestionBankNotFoundError';
    importQuestionsFromCsvExecuteMock.mockRejectedValue(notFound);
    const { importQuestionsFromCsvAction } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/csv-import-action'
    );

    const result = await importQuestionsFromCsvAction(
      bankId,
      initialState,
      formDataWith({ csvContent: 'prompt\nP1' }),
    );

    expect(result).toEqual({
      ok: false,
      error: 'El banco de preguntas no existe o no tenés acceso a él.',
    });
  });
});

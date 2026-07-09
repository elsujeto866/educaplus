'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { toActionError } from '../../_lib/action-result';

export interface CsvImportSkippedRow {
  row: number;
  reason: string;
}

export type CsvImportActionResult =
  | { ok: true; imported: number; skipped: CsvImportSkippedRow[] }
  | { ok: false; error: string };

const csvImportSchema = z.object({
  csvContent: z.string().trim().min(1, 'Pegá el contenido del CSV antes de importar.'),
});

/**
 * importQuestionsFromCsvAction — CSV question import Server Action for the
 * bank detail page.
 *
 * PHASE-1 FALLBACK (deviation from a native file picker, noted per tasks.md
 * 5.3): this Next.js version has NO established `<input type="file">` →
 * Server Action upload convention anywhere in `src/app` (every existing
 * form submits plain string/JSON fields — confirmed by search). Rather than
 * invent an unreviewed convention, the CSV content travels as PASTED TEXT
 * via a `<textarea name="csvContent">`. A real file-picker can replace this
 * later without touching `ImportQuestionsFromCsvUseCase` itself — the
 * use-case only ever sees a `content: string`.
 *
 * `ImportQuestionsFromCsvUseCase.execute()` requires a caller-supplied
 * `ids` array, one id PER PARSED ROW (matched by array index — see
 * `application/import-questions-from-csv.use-case.ts`). Delivery has no
 * access to `CsvQuestionSource` to parse ahead of time (hexagonal boundary:
 * `src/app` may only depend on `composition`, never `domain`/
 * `infrastructure` directly — eslint-boundaries), so the exact parsed-row
 * count is unknown here. Instead this generates one id per non-blank
 * PHYSICAL LINE in the pasted content, which is always >= the real
 * parsed-row count (each data row occupies exactly one physical line; the
 * header line consumes one extra, unused id). Any id beyond
 * `parsedRows.length` is simply never read by the use-case
 * (`input.ids[index]` only indexes up to the parsed row count).
 *
 * Uses a bespoke `CsvImportActionResult` (not the shared `ActionResult`)
 * because a successful import must surface the skip-invalid report
 * (`imported` count + `skipped[]` rows with reasons), not just `{ ok: true
 * }` — mirrors how `ActionResult`'s `ok:false` branch is reused verbatim
 * via `toActionError`.
 */
export async function importQuestionsFromCsvAction(
  bankId: string,
  _prevState: CsvImportActionResult,
  formData: FormData,
): Promise<CsvImportActionResult> {
  const parsed = csvImportSchema.safeParse({
    csvContent: (formData.get('csvContent') ?? '').toString(),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }

  const ctx = await getTenantContext();

  const lineCount = parsed.data.csvContent
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim().length > 0).length;
  const ids = Array.from({ length: lineCount }, () => crypto.randomUUID());

  let report;
  try {
    report = await makeSimulatorComposition().importQuestionsFromCsv.execute(ctx, {
      bankId,
      academyId: ctx.orgId,
      content: parsed.data.csvContent,
      ids,
    });
  } catch (error) {
    const mapped = toActionError(error);
    return mapped.ok ? { ok: false, error: 'Ocurrió un error. Intentá de nuevo.' } : mapped;
  }

  revalidatePath(`/dashboard/simulators/banks/${bankId}`);
  return { ok: true, imported: report.imported, skipped: report.skipped };
}

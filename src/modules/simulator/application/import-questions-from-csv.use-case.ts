import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Question } from '../domain/question.entity';
import type { Difficulty } from '../domain/value-objects/difficulty.vo';
import type { QuestionRepository } from '../domain/ports/question.repository';
import type { CsvQuestionSource } from '../domain/ports/csv-question-source.port';

export interface ImportQuestionsFromCsvInput {
  bankId: string;
  academyId: string;
  /** Raw CSV file content (see design.md "CSV contract" for the column layout). */
  content: string;
  /**
   * Caller-supplied UUIDs, one per PARSED data row (by array index, in file
   * order) — mirrors `AddQuestionUseCase`'s "id is a use-case input, never
   * generated internally" convention. A row whose index has no corresponding
   * id is skipped defensively rather than throwing (see execute()).
   */
  ids: string[];
}

export interface SkippedCsvRow {
  row: number;
  reason: string;
}

export interface ImportQuestionsFromCsvReport {
  imported: number;
  skipped: SkippedCsvRow[];
}

/**
 * ImportQuestionsFromCsvUseCase
 *
 * SKIP-INVALID policy (spec.md / design.md): every parsed row is funneled
 * through `new Question(...)` — the SAME constructor gate `AddQuestionUseCase`
 * uses, so every shipped invariant (>=2 options, unique option ids,
 * correctOptionId must reference an existing option, non-empty prompt,
 * valid difficulty) is reused verbatim, with zero duplicated validation
 * logic. A row that fails construction is recorded in `skipped[]` with the
 * thrown error's message as `reason` and the import continues — one bad
 * row never aborts the whole file. Valid rows are persisted immediately
 * (not batched), positioned contiguously after the bank's existing
 * questions (`countByBank` snapshotted once at the start, mirroring
 * `AddQuestionUseCase`'s `count + 1` convention).
 *
 * Authorization: admin or instructor (same as `AddQuestionUseCase`).
 */
export class ImportQuestionsFromCsvUseCase {
  constructor(
    private readonly questionRepo: QuestionRepository,
    private readonly csvSource: CsvQuestionSource,
  ) {}

  async execute(
    ctx: TenantContext,
    input: ImportQuestionsFromCsvInput,
  ): Promise<ImportQuestionsFromCsvReport> {
    assertRole(ctx, ['admin', 'instructor']);

    const parsedRows = this.csvSource.parse(input.content);
    const startingCount = await this.questionRepo.countByBank(ctx, input.bankId);

    const skipped: SkippedCsvRow[] = [];
    let imported = 0;
    const now = new Date();

    for (let index = 0; index < parsedRows.length; index += 1) {
      const parsed = parsedRows[index]!;
      const id = input.ids[index];

      if (!id) {
        skipped.push({ row: parsed.rowNumber, reason: 'no id supplied for this row' });
        continue;
      }

      try {
        const question = new Question({
          id,
          bankId: input.bankId,
          academyId: input.academyId,
          prompt: parsed.prompt,
          options: parsed.options,
          correctOptionId: parsed.correctOptionId,
          topic: parsed.topic,
          difficulty: parsed.difficulty as Difficulty | null,
          explanation: parsed.explanation,
          position: startingCount + imported + 1,
          createdAt: now,
          updatedAt: now,
        });

        await this.questionRepo.create(ctx, question);
        imported += 1;
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'unknown error';
        skipped.push({ row: parsed.rowNumber, reason });
      }
    }

    return { imported, skipped };
  }
}

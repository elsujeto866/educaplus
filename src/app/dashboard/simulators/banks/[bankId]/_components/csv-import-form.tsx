'use client';

import { useActionState } from 'react';
import { importQuestionsFromCsvAction } from '../csv-import-action';
import type { CsvImportActionResult } from '../csv-import-action';
import { Button } from '@/shared/ui/atoms/button';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';

const initialState: CsvImportActionResult = { ok: true, imported: 0, skipped: [] };

interface CsvImportFormProps {
  bankId: string;
}

/**
 * 'use client' island — bulk question import from a pasted CSV. Phase 1
 * fallback (see `csv-import-action.ts`'s doc comment): the CSV content is
 * pasted into a `<textarea>` rather than uploaded as a file, since this app
 * has no established file-upload → Server Action convention yet.
 *
 * Renders the skip-invalid report on success: imported count plus every
 * skipped row (physical row number + reason), mirroring
 * `ImportQuestionsFromCsvUseCase`'s report shape verbatim.
 */
export function CsvImportForm({ bankId }: CsvImportFormProps) {
  const boundAction = importQuestionsFromCsvAction.bind(null, bankId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-foreground">Importar preguntas desde CSV</h2>
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Contenido del CSV" htmlFor="csvContent" error={error}>
          <Textarea
            id="csvContent"
            name="csvContent"
            rows={6}
            placeholder="prompt,option_a,option_b,option_c,option_d,correct_option,topic,difficulty,explanation"
            disabled={isPending}
          />
        </FormField>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Importando...' : 'Importar'}
        </Button>
      </form>

      {state.ok && (state.imported > 0 || state.skipped.length > 0) ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-foreground">
            Se importaron <strong>{state.imported}</strong> pregunta(s).
          </p>
          {state.skipped.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">Filas omitidas ({state.skipped.length}):</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {state.skipped.map((skipped) => (
                  <li key={skipped.row}>
                    Fila {skipped.row}: {skipped.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

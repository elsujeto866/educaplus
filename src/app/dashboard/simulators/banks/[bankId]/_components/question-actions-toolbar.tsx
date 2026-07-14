'use client';

import { useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { QuestionFormCard } from './question-form-card';
import { CsvImportForm } from './csv-import-form';

interface QuestionActionsToolbarProps {
  bankId: string;
}

/**
 * 'use client' island — replaces the always-open add form + CSV form
 * (noisy) with two low-noise toggle buttons. Collapsed by default so the
 * question list stays the visual focus of the page. Each toggle is
 * independent (no accordion/mutual exclusion) — kept simple per the
 * redesign brief.
 */
export function QuestionActionsToolbar({ bankId }: QuestionActionsToolbarProps) {
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" aria-expanded={adding} onClick={() => setAdding((prev) => !prev)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Agregar pregunta
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-expanded={importing}
          onClick={() => setImporting((prev) => !prev)}
        >
          <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Importar CSV
        </Button>
      </div>

      {adding ? <QuestionFormCard bankId={bankId} mode="add" onDone={() => setAdding(false)} /> : null}
      {importing ? <CsvImportForm bankId={bankId} /> : null}
    </div>
  );
}

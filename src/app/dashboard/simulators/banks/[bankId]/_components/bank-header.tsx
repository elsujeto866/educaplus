'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { BankEditForm } from './bank-edit-form';
import { BankDeleteAction } from './bank-delete-action';

interface BankHeaderProps {
  bankId: string;
  title: string;
  description: string;
}

/**
 * 'use client' island — bank title plus low-noise corner icon actions.
 * `BankEditForm` is HIDDEN by default and only revealed inline when the
 * pencil icon is toggled (never always-open, per the redesign brief).
 * `BankDeleteAction` keeps owning its own confirm-dialog flow; this
 * component only places its icon trigger next to the pencil.
 */
export function BankHeader({ bankId, title, description }: BankHeaderProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title={title} subtitle="Gestioná las preguntas del banco." className="flex-1 text-left" />
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            aria-label="Editar banco"
            aria-expanded={editing}
            onClick={() => setEditing((prev) => !prev)}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <BankDeleteAction bankId={bankId} />
        </div>
      </div>

      {editing ? <BankEditForm bankId={bankId} title={title} description={description} /> : null}
    </div>
  );
}

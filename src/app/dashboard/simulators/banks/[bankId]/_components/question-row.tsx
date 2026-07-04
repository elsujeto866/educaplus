'use client';

import { useState } from 'react';
import { deleteQuestionAction } from '../actions';
import type { QuestionDraft } from '../_lib/question-form';
import { Button } from '@/shared/ui/atoms/button';
import { Badge } from '@/shared/ui/atoms/badge';
import { Card } from '@/shared/ui/atoms/card';
import { ConfirmDialog } from '@/shared/ui/organisms/confirm-dialog';
import { QuestionFormCard } from './question-form-card';

const DIFFICULTY_LABEL: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'Fácil',
  medium: 'Media',
  hard: 'Difícil',
};

/**
 * Local, delivery-owned shape — deliberately NOT importing `Question` from
 * `modules/simulator/domain` (eslint-boundaries: delivery may only reach
 * `domain` via `composition`). A `Question` entity instance satisfies this
 * interface structurally, so the caller can pass it straight through.
 */
export interface QuestionRowData {
  id: string;
  prompt: string;
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  explanation: string | null;
  options: { id: string; label: string }[];
  correctOptionId: string;
}

interface QuestionRowProps {
  bankId: string;
  question: QuestionRowData;
}

/**
 * 'use client' island — one question's read view, toggling into
 * `QuestionFormCard` (edit mode) or a delete confirmation. No route change
 * on edit/delete (mirrors the bank detail page owning the whole authoring
 * surface, per the task list's route scope: only `/dashboard/simulators`
 * and `/dashboard/simulators/banks/[bankId]`).
 */
export function QuestionRow({ bankId, question }: QuestionRowProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (editing) {
    const draft: QuestionDraft = {
      prompt: question.prompt,
      topic: question.topic ?? '',
      difficulty: question.difficulty ?? '',
      explanation: question.explanation ?? '',
      options: question.options,
      correctOptionId: question.correctOptionId,
    };

    return (
      <QuestionFormCard
        bankId={bankId}
        mode="edit"
        questionId={question.id}
        initialDraft={draft}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm font-medium text-foreground">{question.prompt}</p>
      <div className="flex flex-wrap gap-2">
        {question.topic ? <Badge>{question.topic}</Badge> : null}
        {question.difficulty ? <Badge variant="accent">{DIFFICULTY_LABEL[question.difficulty]}</Badge> : null}
      </div>
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        {question.options.map((option) => (
          <li
            key={option.id}
            className={option.id === question.correctOptionId ? 'font-medium text-primary' : undefined}
          >
            {option.label}
            {option.id === question.correctOptionId ? ' ✓' : ''}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <Button type="button" variant="danger" onClick={() => setConfirmingDelete(true)}>
          Eliminar
        </Button>
      </div>
      {confirmingDelete ? (
        <ConfirmDialog
          title="Eliminar pregunta"
          description="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            void deleteQuestionAction(bankId, question.id, new FormData());
          }}
        />
      ) : null}
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
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
 * `domain` via `composition`).
 *
 * IMPORTANT: a `Question` entity instance satisfies this interface
 * STRUCTURALLY, but must NEVER be passed straight through — `QuestionRow` is
 * `'use client'`, and RSC can only serialize plain objects across the
 * server->client boundary (a class instance throws at render time). The
 * caller (`QuestionList`'s `toQuestionRowData`) always rebuilds a fresh
 * plain object literal before it reaches this component.
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
  /** 1-based display position — computed from the list's render order (not the domain `position` field). */
  position: number;
}

/**
 * 'use client' island — compact "expand-to-act" row. Collapsed by default:
 * position number, truncated prompt, topic/difficulty badges, and a
 * chevron — no edit/delete controls visible. Clicking the row expands it
 * to reveal the full options list plus small ghost icon edit/delete
 * buttons in the corner. Edit toggles into `QuestionFormCard` (edit mode);
 * delete opens the existing `ConfirmDialog` flow. No route change on
 * edit/delete (mirrors the bank detail page owning the whole authoring
 * surface, per the task list's route scope: only `/dashboard/simulators`
 * and `/dashboard/simulators/banks/[bankId]`).
 */
export function QuestionRow({ bankId, question, position }: QuestionRowProps) {
  const [expanded, setExpanded] = useState(false);
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
      <button
        type="button"
        className="flex items-start gap-3 text-left"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="mt-0.5 shrink-0 text-sm font-medium text-muted-foreground">#{position}</span>
        <span className="line-clamp-2 flex-1 text-sm font-medium text-foreground">{question.prompt}</span>
      </button>

      <div className="flex flex-wrap gap-2 pl-7">
        {question.topic ? <Badge>{question.topic}</Badge> : null}
        {question.difficulty ? <Badge variant="accent">{DIFFICULTY_LABEL[question.difficulty]}</Badge> : null}
      </div>

      {expanded ? (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
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
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              aria-label="Editar pregunta"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-label="Eliminar pregunta"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

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

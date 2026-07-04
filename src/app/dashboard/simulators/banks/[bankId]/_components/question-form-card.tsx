'use client';

import { useActionState, useReducer } from 'react';
import { addQuestionAction, updateQuestionAction } from '../actions';
import type { ActionResult } from '../../../_lib/action-result';
import {
  questionFormReducer,
  createEmptyQuestionDraft,
  validateQuestionDraft,
  serializeOptionsPayload,
  type QuestionDraft,
  type DifficultyDraft,
} from '../_lib/question-form';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { Select } from '@/shared/ui/atoms/select';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';

const initialState: ActionResult = { ok: true };

const DIFFICULTY_OPTIONS: { value: Exclude<DifficultyDraft, ''>; label: string }[] = [
  { value: 'easy', label: 'Fácil' },
  { value: 'medium', label: 'Media' },
  { value: 'hard', label: 'Difícil' },
];

interface QuestionFormCardProps {
  bankId: string;
  mode: 'add' | 'edit';
  /** Required when `mode === 'edit'`. */
  questionId?: string;
  initialDraft?: QuestionDraft;
  onDone?: () => void;
}

/**
 * 'use client' island — shared add/edit form for a single question. Unlike
 * `courses/[courseId]/quiz/_components/quiz-builder-form.tsx` (which
 * upserts an entire question array in one payload), each question here is
 * its own repository row (Decision 1), so `mode` binds to either
 * `addQuestionAction` or `updateQuestionAction` — one Server Action call
 * per question. Options travel as a hidden JSON payload
 * (`serializeOptionsPayload`); prompt/topic/difficulty/explanation travel
 * as plain named fields, mirroring the quiz builder's payload split.
 */
export function QuestionFormCard({ bankId, mode, questionId, initialDraft, onDone }: QuestionFormCardProps) {
  const boundAction =
    mode === 'add'
      ? addQuestionAction.bind(null, bankId)
      : updateQuestionAction.bind(null, bankId, questionId as string);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [draft, dispatch] = useReducer(
    questionFormReducer,
    undefined,
    () => initialDraft ?? createEmptyQuestionDraft(crypto.randomUUID(), crypto.randomUUID()),
  );

  const validationError = validateQuestionDraft(draft);
  const actionError = state.ok ? undefined : state.error;
  const canSubmit = !validationError;
  const idPrefix = `question-${mode}-${questionId ?? 'new'}`;

  return (
    <Card className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Enunciado" htmlFor={`${idPrefix}-prompt`} error={actionError ?? validationError}>
          <Textarea
            id={`${idPrefix}-prompt`}
            name="prompt"
            value={draft.prompt}
            onChange={(e) => dispatch({ type: 'SET_PROMPT', prompt: e.target.value })}
            rows={2}
            disabled={isPending}
          />
        </FormField>

        <FormField label="Tema (opcional)" htmlFor={`${idPrefix}-topic`}>
          <Input
            id={`${idPrefix}-topic`}
            name="topic"
            value={draft.topic}
            onChange={(e) => dispatch({ type: 'SET_TOPIC', topic: e.target.value })}
            disabled={isPending}
          />
        </FormField>

        <FormField label="Dificultad (opcional)" htmlFor={`${idPrefix}-difficulty`}>
          <Select
            id={`${idPrefix}-difficulty`}
            name="difficulty"
            value={draft.difficulty}
            onChange={(e) => dispatch({ type: 'SET_DIFFICULTY', difficulty: e.target.value as DifficultyDraft })}
            disabled={isPending}
          >
            <option value="">Sin clasificar</option>
            {DIFFICULTY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Explicación (opcional)" htmlFor={`${idPrefix}-explanation`}>
          <Textarea
            id={`${idPrefix}-explanation`}
            name="explanation"
            value={draft.explanation}
            onChange={(e) => dispatch({ type: 'SET_EXPLANATION', explanation: e.target.value })}
            rows={2}
            disabled={isPending}
          />
        </FormField>

        <input type="hidden" name="optionsPayload" value={serializeOptionsPayload(draft)} readOnly />

        <div className="flex flex-col gap-2">
          {draft.options.map((option, index) => {
            const optionNumber = index + 1;
            return (
              <div key={option.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${idPrefix}-correct`}
                  aria-label={`Marcar opción ${optionNumber} como correcta`}
                  checked={option.id === draft.correctOptionId}
                  onChange={() => dispatch({ type: 'SET_CORRECT_OPTION', optionId: option.id })}
                  disabled={isPending}
                  className="h-4 w-4 accent-primary"
                />
                <Input
                  aria-label={`Opción ${optionNumber}`}
                  value={option.label}
                  onChange={(e) =>
                    dispatch({ type: 'SET_OPTION_LABEL', optionId: option.id, label: e.target.value })
                  }
                  placeholder="Texto de la opción"
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Quitar opción ${optionNumber}`}
                  onClick={() => dispatch({ type: 'REMOVE_OPTION', optionId: option.id })}
                  disabled={isPending || draft.options.length <= 2}
                >
                  Quitar
                </Button>
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => dispatch({ type: 'ADD_OPTION', optionId: crypto.randomUUID() })}
        >
          Agregar opción
        </Button>

        <div className="flex gap-2">
          <Button type="submit" disabled={isPending || !canSubmit}>
            {isPending ? 'Guardando...' : mode === 'add' ? 'Agregar pregunta' : 'Guardar cambios'}
          </Button>
          {onDone ? (
            <Button type="button" variant="secondary" disabled={isPending} onClick={onDone}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

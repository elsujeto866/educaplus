'use client';

import { useActionState, useReducer, useState } from 'react';
import { saveQuizAction } from '../actions';
import type { ActionResult } from '../../../_lib/action-result';
import {
  quizReducer,
  validateQuizDraft,
  serializeQuizPayload,
  type QuizQuestionDraft,
} from '../_lib/quiz-form';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';
import { QuizQuestionEditor } from './quiz-question-editor';

const initialState: ActionResult = { ok: true };

interface QuizBuilderFormProps {
  courseId: string;
  initialTitle: string;
  initialQuestions: QuizQuestionDraft[];
}

/**
 * 'use client' island — the quiz builder. Local reducer owns the question
 * drafts (add/remove/reorder question+option, exclusive radio-correct,
 * edit text); the title is a plain controlled input. Submit is gated by
 * `validateQuizDraft` (spec.md: empty questions[] stays a valid, always
 * submittable draft — only a PRESENT malformed question blocks submit).
 * The hidden `payload` field carries the serialized draft to
 * `saveQuizAction`, which re-derives truth via `QuizQuestionFactory`.
 */
export function QuizBuilderForm({ courseId, initialTitle, initialQuestions }: QuizBuilderFormProps) {
  const boundAction = saveQuizAction.bind(null, courseId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [title, setTitle] = useState(initialTitle);
  const [questions, dispatch] = useReducer(quizReducer, initialQuestions);

  const errors = validateQuizDraft(questions);
  const errorFor = (questionId: string) => errors.find((e) => e.questionId === questionId)?.message;
  const canSubmit = errors.length === 0;
  const actionError = state.ok ? undefined : state.error;

  return (
    <Card className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-6">
        <FormField label="Título de la evaluación" htmlFor="quiz-title" error={actionError}>
          <Input
            id="quiz-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={200}
            disabled={isPending}
          />
        </FormField>

        <input type="hidden" name="payload" value={serializeQuizPayload(questions)} readOnly />

        <div className="flex flex-col gap-4">
          {questions.map((question, index) => (
            <QuizQuestionEditor
              key={question.id}
              index={index}
              question={question}
              error={errorFor(question.id)}
              disabled={isPending}
              canMoveUp={index > 0}
              canMoveDown={index < questions.length - 1}
              onPromptChange={(prompt) =>
                dispatch({ type: 'SET_PROMPT', questionId: question.id, prompt })
              }
              onAddOption={() =>
                dispatch({ type: 'ADD_OPTION', questionId: question.id, optionId: crypto.randomUUID() })
              }
              onRemoveOption={(optionId) =>
                dispatch({ type: 'REMOVE_OPTION', questionId: question.id, optionId })
              }
              onOptionLabelChange={(optionId, label) =>
                dispatch({ type: 'SET_OPTION_LABEL', questionId: question.id, optionId, label })
              }
              onSelectCorrect={(optionId) =>
                dispatch({ type: 'SET_CORRECT_OPTION', questionId: question.id, optionId })
              }
              onMoveUp={() =>
                dispatch({ type: 'REORDER_QUESTION', questionId: question.id, direction: 'up' })
              }
              onMoveDown={() =>
                dispatch({ type: 'REORDER_QUESTION', questionId: question.id, direction: 'down' })
              }
              onRemoveQuestion={() => dispatch({ type: 'REMOVE_QUESTION', questionId: question.id })}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() =>
            dispatch({
              type: 'ADD_QUESTION',
              questionId: crypto.randomUUID(),
              optionAId: crypto.randomUUID(),
              optionBId: crypto.randomUUID(),
            })
          }
        >
          Agregar pregunta
        </Button>

        <Button type="submit" disabled={isPending || !canSubmit}>
          {isPending ? 'Guardando...' : 'Guardar evaluación'}
        </Button>
      </form>
    </Card>
  );
}

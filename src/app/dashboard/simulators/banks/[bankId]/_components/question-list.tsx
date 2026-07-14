import { Card } from '@/shared/ui/atoms/card';
import { QuestionRow, type QuestionRowData } from './question-row';

/**
 * Structural input shape — mirrors the `Question` domain entity's public
 * fields. Deliberately NOT importing `Question` from `modules/simulator/domain`
 * (eslint-boundaries: delivery may only reach `domain` via `composition`); a
 * `Question` entity instance satisfies this shape structurally, so the page
 * can pass it straight through to `QuestionList` with no cast.
 *
 * UNLIKE `QuestionRowData`, this type only describes the INPUT — every
 * question is re-built into a plain object literal by `toQuestionRowData`
 * below before it ever reaches the `'use client'` `QuestionRow` island. RSC
 * can only serialize plain objects across the server->client boundary; a
 * class instance throws at render time ("Only plain objects... Classes...
 * are not supported").
 */
interface QuestionEntityLike {
  id: string;
  prompt: string;
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  explanation: string | null;
  options: { id: string; label: string }[];
  correctOptionId: string;
}

/**
 * toQuestionRowData — explicit field-by-field mapper, never a spread, so a
 * `Question` entity (or anything else structurally matching
 * `QuestionEntityLike`) is stripped down to a plain object literal with
 * `Object.prototype` before crossing into the client boundary.
 */
function toQuestionRowData(question: QuestionEntityLike): QuestionRowData {
  return {
    id: question.id,
    prompt: question.prompt,
    topic: question.topic,
    difficulty: question.difficulty,
    explanation: question.explanation,
    options: question.options.map((option) => ({ id: option.id, label: option.label })),
    correctOptionId: question.correctOptionId,
  };
}

interface QuestionListProps {
  bankId: string;
  questions: QuestionEntityLike[];
}

/**
 * Server-renderable list wrapper — maps ordered questions to `QuestionRow`
 * client islands. Kept out of the page component to avoid a mega-component
 * (mirrors `courses/[courseId]/_components/modules-list.tsx`).
 */
export function QuestionList({ bankId, questions }: QuestionListProps) {
  if (questions.length === 0) {
    return <Card className="text-center text-sm text-muted-foreground">Este banco todavía no tiene preguntas</Card>;
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.map((question, index) => (
        <QuestionRow
          key={question.id}
          bankId={bankId}
          question={toQuestionRowData(question)}
          position={index + 1}
        />
      ))}
    </div>
  );
}

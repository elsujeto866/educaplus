import { Card } from '@/shared/ui/atoms/card';
import { QuestionRow, type QuestionRowData } from './question-row';

interface QuestionListProps {
  bankId: string;
  questions: QuestionRowData[];
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
      {questions.map((question) => (
        <QuestionRow key={question.id} bankId={bankId} question={question} />
      ))}
    </div>
  );
}

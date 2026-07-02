import { Radio } from '@/shared/ui/atoms/radio';
import type { QuizViewQuestion } from '../_lib/quiz-view';

interface QuizQuestionProps {
  index: number;
  question: QuizViewQuestion;
  selectedOptionId?: string | undefined;
  disabled?: boolean | undefined;
  onSelect: (optionId: string) => void;
}

/**
 * Presentational question — fieldset/legend + one themed `Radio` per
 * option, mirroring the one-answer-per-question bijection the backend
 * enforces (`assertAnswersValid`). Fully controlled: selection state lives
 * in the parent `QuizRunner`. Covered by `quiz-runner.spec.tsx` (no
 * dedicated spec per design.md's testing strategy).
 */
export function QuizQuestion({
  index,
  question,
  selectedOptionId,
  disabled,
  onSelect,
}: QuizQuestionProps) {
  const questionNumber = index + 1;

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6 shadow-sm">
      <legend className="px-1 text-sm font-semibold text-foreground">
        {`${questionNumber}. ${question.prompt}`}
      </legend>
      <div className="flex flex-col gap-2">
        {question.options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm text-foreground">
            <Radio
              name={`question-${question.id}`}
              value={option.id}
              checked={selectedOptionId === option.id}
              onChange={() => onSelect(option.id)}
              disabled={disabled}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

import { Radio } from '@/shared/ui/atoms/radio';
import type { AttemptViewQuestion } from '../_lib/attempt-view';

interface AttemptQuestionProps {
  index: number;
  question: AttemptViewQuestion;
  selectedOptionId?: string | undefined;
  disabled?: boolean | undefined;
  onSelect: (optionId: string) => void;
}

/**
 * Presentational question — mirrors `QuizQuestion` exactly. Only
 * `AttemptViewQuestion` (never the frozen snapshot with `correctOptionId`)
 * reaches this component — see `_lib/attempt-view.ts`.
 */
export function AttemptQuestion({
  index,
  question,
  selectedOptionId,
  disabled,
  onSelect,
}: AttemptQuestionProps) {
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

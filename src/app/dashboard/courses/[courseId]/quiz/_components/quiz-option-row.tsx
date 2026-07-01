import { Input } from '@/shared/ui/atoms/input';
import { Button } from '@/shared/ui/atoms/button';
import type { QuizOptionDraft } from '../_lib/quiz-form';

interface QuizOptionRowProps {
  questionIndex: number;
  optionIndex: number;
  option: QuizOptionDraft;
  isCorrect: boolean;
  canRemove: boolean;
  disabled?: boolean | undefined;
  onLabelChange: (label: string) => void;
  onSelectCorrect: () => void;
  onRemove: () => void;
}

/**
 * Controlled option row — radio-correct selection + label input + remove.
 * Reuses shared/ui atoms only (no new shared/ui file); the radio itself is
 * plain markup styled with theme-token utilities (no hardcoded colors).
 */
export function QuizOptionRow({
  questionIndex,
  optionIndex,
  option,
  isCorrect,
  canRemove,
  disabled,
  onLabelChange,
  onSelectCorrect,
  onRemove,
}: QuizOptionRowProps) {
  const questionLabel = questionIndex + 1;
  const optionLabel = optionIndex + 1;

  return (
    <div className="flex items-center gap-2">
      <input
        type="radio"
        name={`correct-question-${questionIndex}`}
        aria-label={`Marcar opción ${optionLabel} de la pregunta ${questionLabel} como correcta`}
        checked={isCorrect}
        onChange={onSelectCorrect}
        disabled={disabled}
        className="h-4 w-4 accent-primary"
      />
      <Input
        aria-label={`Opción ${optionLabel} de la pregunta ${questionLabel}`}
        value={option.label}
        onChange={(e) => onLabelChange(e.target.value)}
        placeholder="Texto de la opción"
        disabled={disabled}
      />
      <Button
        type="button"
        variant="ghost"
        aria-label={`Quitar opción ${optionLabel} de la pregunta ${questionLabel}`}
        onClick={onRemove}
        disabled={disabled || !canRemove}
      >
        Quitar
      </Button>
    </div>
  );
}

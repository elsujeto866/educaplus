import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';
import type { QuizQuestionDraft } from '../_lib/quiz-form';
import { QuizOptionRow } from './quiz-option-row';

interface QuizQuestionEditorProps {
  index: number;
  question: QuizQuestionDraft;
  error?: string | undefined;
  disabled?: boolean | undefined;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPromptChange: (prompt: string) => void;
  onAddOption: () => void;
  onRemoveOption: (optionId: string) => void;
  onOptionLabelChange: (optionId: string, label: string) => void;
  onSelectCorrect: (optionId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemoveQuestion: () => void;
}

/**
 * Controlled question editor — prompt, options (add/remove/select-correct),
 * and reorder/remove controls for one question. Reuses shared/ui atoms +
 * FormField (inline error) only; state lives in the parent's reducer.
 */
export function QuizQuestionEditor({
  index,
  question,
  error,
  disabled,
  canMoveUp,
  canMoveDown,
  onPromptChange,
  onAddOption,
  onRemoveOption,
  onOptionLabelChange,
  onSelectCorrect,
  onMoveUp,
  onMoveDown,
  onRemoveQuestion,
}: QuizQuestionEditorProps) {
  const questionNumber = index + 1;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{`Pregunta ${questionNumber}`}</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            aria-label={`Mover pregunta ${questionNumber} arriba`}
            onClick={onMoveUp}
            disabled={disabled || !canMoveUp}
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label={`Mover pregunta ${questionNumber} abajo`}
            onClick={onMoveDown}
            disabled={disabled || !canMoveDown}
          >
            ↓
          </Button>
          <Button
            type="button"
            variant="danger"
            aria-label={`Eliminar pregunta ${questionNumber}`}
            onClick={onRemoveQuestion}
            disabled={disabled}
          >
            Eliminar
          </Button>
        </div>
      </div>

      <FormField
        label={`Enunciado de la pregunta ${questionNumber}`}
        htmlFor={`quiz-question-${question.id}-prompt`}
        error={error}
      >
        <Input
          id={`quiz-question-${question.id}-prompt`}
          value={question.prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={disabled}
        />
      </FormField>

      <div className="flex flex-col gap-2">
        {question.options.map((option, optionIndex) => (
          <QuizOptionRow
            key={option.id}
            questionIndex={index}
            optionIndex={optionIndex}
            option={option}
            isCorrect={option.id === question.correctOptionId}
            canRemove={question.options.length > 2}
            disabled={disabled}
            onLabelChange={(label) => onOptionLabelChange(option.id, label)}
            onSelectCorrect={() => onSelectCorrect(option.id)}
            onRemove={() => onRemoveOption(option.id)}
          />
        ))}
      </div>

      <Button type="button" variant="secondary" onClick={onAddOption} disabled={disabled}>
        Agregar opción
      </Button>
    </Card>
  );
}

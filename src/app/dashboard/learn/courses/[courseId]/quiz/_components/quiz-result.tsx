import Link from 'next/link';
import { Badge } from '@/shared/ui/atoms/badge';
import { Button } from '@/shared/ui/atoms/button';
import { Card } from '@/shared/ui/atoms/card';

interface QuizResultProps {
  score: number;
  passed: boolean;
  onRetake: () => void;
  /** Certificate route, shown as "Ver certificado" ONLY when `passed` is
   *  true (spec.md's "Study-Flow Entry Link"). Omitted (or unset) when the
   *  caller has no way to compute the href, or hides the link entirely. */
  certificateHref?: string;
}

/**
 * Presentational attempt result — spec.md's "Result Non-Disclosure":
 * shows ONLY the score and a PASSED/FAILED indicator, never per-question
 * correctness or the correct option. "Volver a intentar" re-opens the
 * form (unlimited retakes — the backend never rejects a resubmission).
 */
export function QuizResult({ score, passed, onRetake, certificateHref }: QuizResultProps) {
  return (
    <Card className="flex flex-col items-center gap-4 text-center">
      <p className="text-2xl font-semibold text-foreground">{score} / 100</p>
      <Badge variant={passed ? 'success' : 'danger'}>
        {passed ? 'APROBADO' : 'DESAPROBADO'}
      </Badge>
      {passed && certificateHref ? (
        <Link href={certificateHref} className="text-sm font-medium text-primary hover:underline">
          Ver certificado
        </Link>
      ) : null}
      <Button type="button" variant="secondary" onClick={onRetake}>
        Volver a intentar
      </Button>
    </Card>
  );
}

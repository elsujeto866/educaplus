import { Badge } from '@/shared/ui/atoms/badge';
import { Card } from '@/shared/ui/atoms/card';

interface AttemptResultProps {
  score: number;
  passed: boolean;
  status: 'submitted' | 'expired';
}

/**
 * Presentational attempt result — mirrors `QuizResult`'s "Result
 * Non-Disclosure": shows ONLY the score and a PASSED/FAILED indicator,
 * never per-question correctness or the correct option. `status ===
 * 'expired'` additionally surfaces that the attempt timed out (late !=
 * on-time — Decision 5) — still scored, never hidden. No retake action
 * here: retaking means starting a NEW attempt from the simulator detail
 * page (subject to the attempt-limit gate), unlike course's unlimited
 * quiz retakes.
 */
export function AttemptResult({ score, passed, status }: AttemptResultProps) {
  return (
    <Card className="flex flex-col items-center gap-4 text-center">
      <p className="text-2xl font-semibold text-foreground">{score} / 100</p>
      <Badge variant={passed ? 'success' : 'danger'}>{passed ? 'APROBADO' : 'DESAPROBADO'}</Badge>
      {status === 'expired' ? (
        <p className="text-sm text-muted-foreground">
          El tiempo se agotó — se calificaron las respuestas registradas hasta ese momento.
        </p>
      ) : null}
    </Card>
  );
}

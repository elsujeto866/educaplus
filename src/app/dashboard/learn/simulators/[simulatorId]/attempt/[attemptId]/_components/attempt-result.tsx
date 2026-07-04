import Link from 'next/link';
import { Badge } from '@/shared/ui/atoms/badge';
import { Card } from '@/shared/ui/atoms/card';

interface AttemptResultProps {
  score: number;
  passed: boolean;
  status: 'submitted' | 'expired';
  /** Certificate route, shown as "Ver certificado" ONLY when `passed` is
   *  true (Slice S5, mirrors `QuizResult`'s `certificateHref`). Omitted (or
   *  unset) when the caller has no way to compute the href, or hides the
   *  link entirely. */
  certificateHref?: string;
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
export function AttemptResult({ score, passed, status, certificateHref }: AttemptResultProps) {
  return (
    <Card className="flex flex-col items-center gap-4 text-center">
      <p className="text-2xl font-semibold text-foreground">{score} / 100</p>
      <Badge variant={passed ? 'success' : 'danger'}>{passed ? 'APROBADO' : 'DESAPROBADO'}</Badge>
      {status === 'expired' ? (
        <p className="text-sm text-muted-foreground">
          El tiempo se agotó — se calificaron las respuestas registradas hasta ese momento.
        </p>
      ) : null}
      {passed && certificateHref ? (
        <Link href={certificateHref} className="text-sm font-medium text-primary hover:underline">
          Ver certificado
        </Link>
      ) : null}
    </Card>
  );
}

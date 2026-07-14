import { Badge } from '@/shared/ui/atoms/badge';
import { Card } from '@/shared/ui/atoms/card';
import type { BankDifficultyCounts, BankTopicCount } from '../_lib/bank-stats';

interface BankOverviewProps {
  total: number;
  byDifficulty: BankDifficultyCounts;
  byTopic: BankTopicCount[];
}

const DIFFICULTY_CHIPS: { key: keyof BankDifficultyCounts; label: string }[] = [
  { key: 'easy', label: 'Fácil' },
  { key: 'medium', label: 'Media' },
  { key: 'hard', label: 'Difícil' },
  { key: 'unclassified', label: 'Sin clasificar' },
];

/**
 * "Vista general" overview — server-renderable (no client state). Plain
 * numeric/string props only, computed by `computeBankStats` upstream in
 * `page.tsx`. Bare stat tiles: identity by LABEL text, never color alone
 * (per the redesign brief), no chart library.
 */
export function BankOverview({ total, byDifficulty, byTopic }: BankOverviewProps) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-foreground">Vista general</h2>

      <div>
        <p className="text-3xl font-bold text-foreground">{total}</p>
        <p className="text-sm text-muted-foreground">Total de preguntas</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">Por dificultad</p>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_CHIPS.map((chip) => (
            <Badge key={chip.key} className="gap-1.5">
              <span>{chip.label}</span>
              <span className="font-semibold text-foreground">{byDifficulty[chip.key]}</span>
            </Badge>
          ))}
        </div>
      </div>

      {byTopic.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Por tema</p>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {byTopic.map((entry) => (
              <li key={entry.topic}>
                {entry.topic} · <span className="text-foreground">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

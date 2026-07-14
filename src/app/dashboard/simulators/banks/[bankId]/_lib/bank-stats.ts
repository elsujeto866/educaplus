/**
 * Pure helper computing the bank detail "Vista general" overview stats
 * from the already-plain question rows (never a `Question` domain
 * entity — see `question-list.tsx`'s RSC-serialization doc comment).
 * Zero framework imports — unit-testable without React/DOM.
 */

export interface BankStatsInputRow {
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
}

export interface BankDifficultyCounts {
  easy: number;
  medium: number;
  hard: number;
  unclassified: number;
}

export interface BankTopicCount {
  topic: string;
  count: number;
}

export interface BankStats {
  total: number;
  byDifficulty: BankDifficultyCounts;
  byTopic: BankTopicCount[];
}

/** Label for the "no topic assigned" bucket — also used for blank/whitespace-only topics. */
const NO_TOPIC_LABEL = 'Sin tema';

export function computeBankStats(rows: BankStatsInputRow[]): BankStats {
  const byDifficulty: BankDifficultyCounts = { easy: 0, medium: 0, hard: 0, unclassified: 0 };
  const topicCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.difficulty) {
      byDifficulty[row.difficulty] += 1;
    } else {
      byDifficulty.unclassified += 1;
    }

    const topicLabel = row.topic?.trim() ? row.topic : NO_TOPIC_LABEL;
    topicCounts.set(topicLabel, (topicCounts.get(topicLabel) ?? 0) + 1);
  }

  const byTopic = Array.from(topicCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  return { total: rows.length, byDifficulty, byTopic };
}

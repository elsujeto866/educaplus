import {
  reorderTrackStepUpAction,
  reorderTrackStepDownAction,
  removeTrackStepAction,
} from '../../actions';
import { Button } from '@/shared/ui/atoms/button';
import { Badge } from '@/shared/ui/atoms/badge';
import { Card } from '@/shared/ui/atoms/card';

// Inline literal union instead of importing `Simulator`'s status type from
// the domain layer — `src/app` may not depend on `domain` directly
// (eslint-boundaries). Same rationale as `simulators/page.tsx`'s STATUS_LABEL.
const STATUS_LABEL: Record<'draft' | 'published', string> = {
  draft: 'Borrador',
  published: 'Publicado',
};

interface TrackStepRowProps {
  trackId: string;
  stepId: string;
  position: number;
  simulatorTitle: string;
  simulatorStatus: 'draft' | 'published';
  isFirst: boolean;
  isLast: boolean;
}

/**
 * Single track step row — position, the underlying simulator's title and
 * publish-status badge, up/down reorder buttons (plain forms bound to the
 * already-tested `reorderTrackStep{Up,Down}Action`; no client JS needed),
 * and a remove button. No `'use client'`: forms submitting to Server
 * Actions work natively in Server Components. Mirrors
 * `courses/[courseId]/_components/module-row.tsx`.
 */
export function TrackStepRow({
  trackId,
  stepId,
  position,
  simulatorTitle,
  simulatorStatus,
  isFirst,
  isLast,
}: TrackStepRowProps) {
  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-muted-foreground">{position}</span>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{simulatorTitle}</span>
          <Badge variant={simulatorStatus === 'published' ? 'success' : 'default'}>
            {STATUS_LABEL[simulatorStatus]}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <form action={reorderTrackStepUpAction.bind(null, trackId, stepId)}>
          <Button
            type="submit"
            variant="ghost"
            disabled={isFirst}
            aria-label={`Mover "${simulatorTitle}" hacia arriba`}
          >
            ↑
          </Button>
        </form>
        <form action={reorderTrackStepDownAction.bind(null, trackId, stepId)}>
          <Button
            type="submit"
            variant="ghost"
            disabled={isLast}
            aria-label={`Mover "${simulatorTitle}" hacia abajo`}
          >
            ↓
          </Button>
        </form>
        <form action={removeTrackStepAction.bind(null, trackId, stepId)}>
          <Button type="submit" variant="danger">
            Quitar
          </Button>
        </form>
      </div>
    </Card>
  );
}

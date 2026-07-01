import { FileText, Video } from 'lucide-react';
import { Badge } from '@/shared/ui/atoms/badge';
import { cn } from '@/shared/lib/cn';

export type LessonType = 'video' | 'text';

interface LessonListItemProps {
  title: string;
  type: LessonType;
  completed: boolean;
  className?: string;
}

const TYPE_LABEL: Record<LessonType, string> = {
  video: 'Video',
  text: 'Texto',
};

/**
 * Lesson row: title, type indicator, completed check. Pure presentational
 * molecule — no Clerk/composition imports (shared-ui boundary only allows
 * shared-ui/shared-lib per eslint.config.mjs).
 */
export function LessonListItem({ title, type, completed, className }: LessonListItemProps) {
  const TypeIcon = type === 'video' ? Video : FileText;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <TypeIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="sr-only">{TYPE_LABEL[type]}</span>
      </div>
      {completed ? (
        <Badge variant="success">Completada</Badge>
      ) : (
        <span className="text-xs text-muted-foreground">Pendiente</span>
      )}
    </div>
  );
}

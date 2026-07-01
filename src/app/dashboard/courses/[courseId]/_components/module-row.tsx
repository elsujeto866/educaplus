import Link from 'next/link';
import { reorderModuleDownAction, reorderModuleUpAction } from '../../actions';
import { Button } from '@/shared/ui/atoms/button';
import { Card } from '@/shared/ui/atoms/card';

interface LessonLinkProp {
  id: string;
  title: string;
}

interface ModuleRowProps {
  courseId: string;
  moduleId: string;
  title: string;
  lessons: LessonLinkProp[];
  isFirst: boolean;
  isLast: boolean;
}

/**
 * Single module row — title, up/down reorder buttons (plain forms bound to
 * the already-tested `reorderModule{Up,Down}Action`; no client JS needed),
 * and a lesson list linking into the (slice 4) lesson editor route. No
 * `'use client'`: forms submitting to Server Actions work natively in
 * Server Components.
 */
export function ModuleRow({ courseId, moduleId, title, lessons, isFirst, isLast }: ModuleRowProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{title}</span>
        <div className="flex gap-2">
          <form action={reorderModuleUpAction.bind(null, courseId, moduleId)}>
            <Button
              type="submit"
              variant="ghost"
              disabled={isFirst}
              aria-label={`Mover "${title}" hacia arriba`}
            >
              ↑
            </Button>
          </form>
          <form action={reorderModuleDownAction.bind(null, courseId, moduleId)}>
            <Button
              type="submit"
              variant="ghost"
              disabled={isLast}
              aria-label={`Mover "${title}" hacia abajo`}
            >
              ↓
            </Button>
          </form>
        </div>
      </div>
      {lessons.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/dashboard/courses/${courseId}/lessons/${lesson.id}`}
                className="text-sm text-primary hover:underline"
              >
                {lesson.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Sin lecciones todavía.</p>
      )}
    </Card>
  );
}

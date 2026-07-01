import { Card } from '@/shared/ui/atoms/card';
import { ModuleRow } from './module-row';

interface LessonProp {
  id: string;
  title: string;
}

interface ModuleProp {
  id: string;
  title: string;
  lessons: LessonProp[];
}

interface ModulesListProps {
  courseId: string;
  modules: ModuleProp[];
}

/**
 * Structural composition of already-tested `ModuleRow` instances — no
 * independent branch to isolate beyond what `module-row.spec.tsx` already
 * covers (isFirst/isLast boundary logic, lesson links, empty state).
 * Mirrors the `courses/page.tsx` precedent from slice 2 for skipping
 * dedicated triangulation on purely structural wrappers.
 */
export function ModulesList({ courseId, modules }: ModulesListProps) {
  if (modules.length === 0) {
    return <Card className="text-center text-sm text-muted-foreground">Todavía no hay módulos en este curso.</Card>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {modules.map((mod, index) => (
        <li key={mod.id}>
          <ModuleRow
            courseId={courseId}
            moduleId={mod.id}
            title={mod.title}
            lessons={mod.lessons}
            isFirst={index === 0}
            isLast={index === modules.length - 1}
          />
        </li>
      ))}
    </ul>
  );
}

import Link from 'next/link';
import { FileText, Video } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export interface CourseOutlineLesson {
  id: string;
  title: string;
  type: 'video' | 'text';
  /** Study pages link to the lesson viewer; authoring pages (no lesson
   *  editor route yet) omit it and the lesson renders as a plain label. */
  href?: string;
  completed?: boolean;
}

export interface CourseOutlineModule {
  id: string;
  title: string;
  lessons: CourseOutlineLesson[];
}

export interface CourseOutlineNode {
  id: string;
  label: string;
  href?: string;
  kind: 'quiz' | 'certificate' | (string & {});
}

export interface CourseOutline {
  courseId: string;
  courseTitle: string;
  courseHref: string;
  modules: CourseOutlineModule[];
  /** Reserved for future non-lesson steps (quiz, certificate). Empty/unset
   *  today — rendering is identical whether omitted or an empty array. */
  extraNodes?: CourseOutlineNode[];
}

interface CourseOutlineSidebarProps {
  outline: CourseOutline;
  /** Current route, from `usePathname()` (owned by the caller) or an
   *  explicit descriptor. `undefined`/`null` highlights nothing. */
  activeHref?: string | null;
  /** md+ icon-rail mode: hides text labels, keeps icons + `title`/`sr-only`
   *  text for accessibility. */
  collapsed?: boolean;
}

function isActive(href: string | undefined, activeHref: string | null | undefined): boolean {
  return !!href && !!activeHref && href === activeHref;
}

const NODE_ACTIVE_CLASSES = 'border border-primary bg-surface-elevated text-primary';
const NODE_INACTIVE_CLASSES = 'text-foreground hover:bg-surface-elevated';

/**
 * Pure presentational course outline tree — no hooks, server-renderable.
 * Renders modules → lessons in the exact order given by `outline`, plus a
 * reserved `extraNodes` trailing section. Interactive concerns (collapse,
 * mobile drawer, `usePathname`) live in the `CourseOutlineNav` client shell
 * that wraps this component; shared-ui boundary only allows shared-ui/
 * shared-lib imports (eslint.config.mjs).
 */
export function CourseOutlineSidebar({ outline, activeHref, collapsed }: CourseOutlineSidebarProps) {
  return (
    <nav aria-label="Índice del curso" className="flex flex-col gap-4 text-sm">
      <Link
        href={outline.courseHref}
        title={outline.courseTitle}
        className={cn(
          'truncate rounded-md px-2 py-1.5 font-semibold transition-colors',
          isActive(outline.courseHref, activeHref)
            ? NODE_ACTIVE_CLASSES
            : 'text-foreground hover:text-primary',
        )}
      >
        {collapsed ? outline.courseTitle.charAt(0).toUpperCase() : outline.courseTitle}
      </Link>

      <ul className="flex flex-col gap-3">
        {outline.modules.map((mod) => (
          <li key={mod.id} className="flex flex-col gap-1">
            {!collapsed ? (
              <span className="truncate px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {mod.title}
              </span>
            ) : (
              <span className="sr-only">{mod.title}</span>
            )}
            <ul className="flex flex-col gap-1">
              {mod.lessons.map((lesson) => {
                const TypeIcon = lesson.type === 'video' ? Video : FileText;
                const active = isActive(lesson.href, activeHref);

                const nodeClasses = cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
                  active ? NODE_ACTIVE_CLASSES : NODE_INACTIVE_CLASSES,
                );

                const content = (
                  <>
                    <TypeIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {!collapsed ? (
                      <span className="truncate">{lesson.title}</span>
                    ) : (
                      <span className="sr-only">{lesson.title}</span>
                    )}
                    {lesson.completed ? <span className="sr-only">Completada</span> : null}
                  </>
                );

                return (
                  <li key={lesson.id}>
                    {lesson.href ? (
                      <Link href={lesson.href} title={lesson.title} className={nodeClasses}>
                        {content}
                      </Link>
                    ) : (
                      <span title={lesson.title} className={nodeClasses}>
                        {content}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      {outline.extraNodes?.length ? (
        <ul className="flex flex-col gap-1 border-t border-border pt-3">
          {outline.extraNodes.map((node) => (
            <li key={node.id}>
              {node.href ? (
                <Link
                  href={node.href}
                  title={node.label}
                  className={cn(
                    'block truncate rounded-md px-2 py-1.5 transition-colors',
                    isActive(node.href, activeHref) ? NODE_ACTIVE_CLASSES : NODE_INACTIVE_CLASSES,
                  )}
                >
                  {collapsed ? <span className="sr-only">{node.label}</span> : node.label}
                </Link>
              ) : (
                <span
                  title={node.label}
                  className="block truncate rounded-md px-2 py-1.5 text-muted-foreground"
                >
                  {collapsed ? <span className="sr-only">{node.label}</span> : node.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}

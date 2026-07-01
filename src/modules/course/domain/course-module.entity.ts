/**
 * CourseModule domain entity.
 *
 * Named CourseModule — never Module — to avoid collision with the TypeScript
 * built-in Module namespace and to make the domain context explicit at every
 * import site.
 *
 * A CourseModule groups lessons within a course. Position is a 1-based
 * integer managed by the reorder use-case.
 *
 * The course's final quiz (Assessment) is course-scoped, not module-scoped —
 * see assessment.entity.ts.
 *
 * Pure TS — zero infrastructure imports.
 */
export interface CourseModuleProps {
  id: string;
  courseId: string;
  academyId: string;
  title: string;
  description?: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CourseModule {
  readonly id: string;
  readonly courseId: string;
  readonly academyId: string;
  readonly title: string;
  readonly description: string | null;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CourseModuleProps) {
    if (!props.id) throw new Error('CourseModule: id is required');
    if (!props.courseId) throw new Error('CourseModule: courseId is required');
    if (!props.academyId) throw new Error('CourseModule: academyId is required');
    if (!props.title) throw new Error('CourseModule: title is required');

    this.id = props.id;
    this.courseId = props.courseId;
    this.academyId = props.academyId;
    this.title = props.title;
    this.description = props.description ?? null;
    this.position = props.position;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}

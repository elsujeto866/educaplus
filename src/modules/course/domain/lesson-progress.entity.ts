/**
 * LessonProgress entity — records that a learner has completed a lesson.
 *
 * The unique constraint (enrollment_id, lesson_id) in the DB makes upserts
 * idempotent — re-marking a completed lesson is a no-op at the DB level.
 * The repository handles this via onConflictDoNothing.
 *
 * Pure TS — zero infrastructure imports.
 */
export interface LessonProgressProps {
  id: string;
  enrollmentId: string;
  lessonId: string;
  academyId: string;
  completedAt: Date;
}

export class LessonProgress {
  readonly id: string;
  readonly enrollmentId: string;
  readonly lessonId: string;
  readonly academyId: string;
  readonly completedAt: Date;

  constructor(props: LessonProgressProps) {
    if (!props.id) throw new Error('LessonProgress: id is required');
    if (!props.enrollmentId) throw new Error('LessonProgress: enrollmentId is required');
    if (!props.lessonId) throw new Error('LessonProgress: lessonId is required');
    if (!props.academyId) throw new Error('LessonProgress: academyId is required');

    this.id = props.id;
    this.enrollmentId = props.enrollmentId;
    this.lessonId = props.lessonId;
    this.academyId = props.academyId;
    this.completedAt = props.completedAt;
  }
}

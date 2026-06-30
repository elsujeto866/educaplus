import type { LessonContent } from './value-objects/lesson-content.vo';
import type { LessonType } from './value-objects/lesson-type.vo';

export interface LessonProps {
  id: string;
  moduleId: string;
  academyId: string;
  type: LessonType;
  title: string;
  position: number;
  /** Polymorphic content payload — discriminated by `type`. */
  content: LessonContent;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lesson entity — base aggregate for CTI lesson content.
 *
 * The `type` field is the Class-Table-Inheritance discriminant:
 *   'video' → lesson_video_assets companion row
 *   'text'  → lesson_text_contents companion row
 *
 * Both rows are written atomically by LessonRepository.create() in a single
 * withTenant transaction. The entity carries the full content VO so callers
 * never need to join back to the companion table manually.
 *
 * Pure TS — zero infrastructure imports.
 */
export class Lesson {
  readonly id: string;
  readonly moduleId: string;
  readonly academyId: string;
  readonly type: LessonType;
  readonly title: string;
  readonly position: number;
  readonly content: LessonContent;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: LessonProps) {
    if (!props.id) throw new Error('Lesson: id is required');
    if (!props.moduleId) throw new Error('Lesson: moduleId is required');
    if (!props.academyId) throw new Error('Lesson: academyId is required');
    if (!props.title) throw new Error('Lesson: title is required');
    if (props.content.type !== props.type) {
      throw new Error(
        `Lesson: content.type "${props.content.type}" does not match lesson type "${props.type}"`,
      );
    }

    this.id = props.id;
    this.moduleId = props.moduleId;
    this.academyId = props.academyId;
    this.type = props.type;
    this.title = props.title;
    this.position = props.position;
    this.content = props.content;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}

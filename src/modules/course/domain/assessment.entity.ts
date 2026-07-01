import { InvalidAssessmentError } from './errors';
import type { QuizQuestion } from './value-objects/quiz-question.vo';

export interface AssessmentProps {
  id: string;
  courseId: string;
  academyId: string;
  title: string;
  /**
   * Typed quiz questions — each element is already validated by
   * QuizQuestionFactory.create() before the entity is constructed.
   * An empty array is a VALID draft state (no "≥1 question" rule at this
   * authoring layer — that belongs to a later publish/take slice).
   */
  questions: QuizQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Assessment entity — the final quiz for a course.
 *
 * One assessment per course (unique FK in the schema: assessments.course_id).
 * Duplicate-assessment detection is enforced by AssessmentRepository.findByCourse
 * in the use-case layer before calling upsert.
 *
 * Pure TS — zero infrastructure imports.
 */
export class Assessment {
  readonly id: string;
  readonly courseId: string;
  readonly academyId: string;
  readonly title: string;
  readonly questions: QuizQuestion[];
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: AssessmentProps) {
    if (!props.id) throw new Error('Assessment: id is required');
    if (!props.courseId) throw new Error('Assessment: courseId is required');
    if (!props.academyId) throw new Error('Assessment: academyId is required');
    if (!props.title) throw new Error('Assessment: title is required');

    const questionIds = props.questions.map((q) => q.id);
    if (new Set(questionIds).size !== questionIds.length) {
      throw new InvalidAssessmentError('question ids must be unique');
    }

    this.id = props.id;
    this.courseId = props.courseId;
    this.academyId = props.academyId;
    this.title = props.title;
    this.questions = props.questions;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}

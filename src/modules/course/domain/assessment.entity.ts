import type { JSONValue } from './value-objects/lesson-content.vo';

export interface AssessmentProps {
  id: string;
  moduleId: string;
  academyId: string;
  title: string;
  /**
   * Opaque JSONB configuration — the schema is owned by the SRS change that
   * will define quiz/flashcard structure. At this layer it is treated as an
   * arbitrary JSON value.
   */
  config: JSONValue;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Assessment entity — placeholder for the SRS assessment system.
 *
 * Each CourseModule has at most one assessment (unique FK in the schema).
 * Duplicate-assessment detection is enforced by AssessmentRepository.findByModule
 * in the use-case layer before calling upsert.
 *
 * Pure TS — zero infrastructure imports.
 */
export class Assessment {
  readonly id: string;
  readonly moduleId: string;
  readonly academyId: string;
  readonly title: string;
  readonly config: JSONValue;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: AssessmentProps) {
    if (!props.id) throw new Error('Assessment: id is required');
    if (!props.moduleId) throw new Error('Assessment: moduleId is required');
    if (!props.academyId) throw new Error('Assessment: academyId is required');
    if (!props.title) throw new Error('Assessment: title is required');

    this.id = props.id;
    this.moduleId = props.moduleId;
    this.academyId = props.academyId;
    this.title = props.title;
    this.config = props.config;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}

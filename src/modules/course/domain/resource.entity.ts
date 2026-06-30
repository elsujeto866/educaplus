/**
 * Resource entity — supplemental material attached to a lesson.
 *
 * Currently only 'link' resources are supported. File uploads are deferred
 * to a future change. Position is 1-based and managed by ResourceRepository.reorder().
 *
 * Pure TS — zero infrastructure imports.
 */
export type ResourceType = 'link';

export interface ResourceProps {
  id: string;
  lessonId: string;
  academyId: string;
  type: ResourceType;
  title: string;
  url: string;
  position: number;
  createdAt: Date;
}

export class Resource {
  readonly id: string;
  readonly lessonId: string;
  readonly academyId: string;
  readonly type: ResourceType;
  readonly title: string;
  readonly url: string;
  readonly position: number;
  readonly createdAt: Date;

  constructor(props: ResourceProps) {
    if (!props.id) throw new Error('Resource: id is required');
    if (!props.lessonId) throw new Error('Resource: lessonId is required');
    if (!props.academyId) throw new Error('Resource: academyId is required');
    if (!props.title) throw new Error('Resource: title is required');
    if (!props.url) throw new Error('Resource: url is required');

    this.id = props.id;
    this.lessonId = props.lessonId;
    this.academyId = props.academyId;
    this.type = props.type;
    this.title = props.title;
    this.url = props.url;
    this.position = props.position;
    this.createdAt = props.createdAt;
  }
}

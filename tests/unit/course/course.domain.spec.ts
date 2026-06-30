import { describe, it, expect } from 'vitest';
import { Course } from '../../../src/modules/course/domain/course.entity';
import { CourseModule } from '../../../src/modules/course/domain/course-module.entity';
import { Lesson } from '../../../src/modules/course/domain/lesson.entity';
import { Enrollment } from '../../../src/modules/course/domain/enrollment.entity';
import { LessonProgress } from '../../../src/modules/course/domain/lesson-progress.entity';
import { Assessment } from '../../../src/modules/course/domain/assessment.entity';
import { Resource } from '../../../src/modules/course/domain/resource.entity';
import {
  SlugConflictError,
  CourseNotPublishedError,
  DuplicateEnrollmentError,
  DuplicateAssessmentError,
} from '../../../src/modules/course/domain/errors';
import { Slug } from '../../../src/modules/course/domain/value-objects/slug.vo';
import { parseLessonType } from '../../../src/modules/course/domain/value-objects/lesson-type.vo';
import { parsePublicationStatus } from '../../../src/modules/course/domain/value-objects/publication-status.vo';

const now = new Date('2025-01-01T00:00:00Z');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCourse(overrides: Partial<ConstructorParameters<typeof Course>[0]> = {}): Course {
  return new Course({
    id: 'course-1',
    academyId: 'org_A',
    slug: 'intro-to-ts',
    title: 'Intro to TypeScript',
    status: 'draft',
    position: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeEnrollmentProps(
  overrides: Partial<ConstructorParameters<typeof Enrollment>[0]> = {},
): ConstructorParameters<typeof Enrollment>[0] {
  return {
    id: 'enrollment-1',
    courseId: 'course-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    enrolledAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Course entity
// ---------------------------------------------------------------------------

describe('Course', () => {
  it('can be instantiated with valid props', () => {
    const course = makeCourse();
    expect(course.id).toBe('course-1');
    expect(course.status).toBe('draft');
    expect(course.isPublished).toBe(false);
    expect(course.publishedAt).toBeNull();
  });

  it('throws when id is empty', () => {
    expect(() => makeCourse({ id: '' })).toThrow('id is required');
  });

  it('throws when academyId is empty', () => {
    expect(() => makeCourse({ academyId: '' })).toThrow('academyId is required');
  });

  it('throws when title is empty', () => {
    expect(() => makeCourse({ title: '' })).toThrow('title is required');
  });

  it('description defaults to null when omitted', () => {
    const course = makeCourse();
    expect(course.description).toBeNull();
  });

  describe('publish / unpublish', () => {
    it('publish() returns a new instance with status published and publishedAt set', () => {
      const draft = makeCourse({ status: 'draft' });
      const published = draft.publish(now);
      expect(published.status).toBe('published');
      expect(published.publishedAt).toBe(now);
      expect(published.isPublished).toBe(true);
      // original is unchanged (immutable)
      expect(draft.status).toBe('draft');
    });

    it('unpublish() returns a new instance with status draft and publishedAt cleared', () => {
      const published = makeCourse({ status: 'published', publishedAt: now });
      const draft = published.unpublish(now);
      expect(draft.status).toBe('draft');
      expect(draft.publishedAt).toBeNull();
      expect(draft.isPublished).toBe(false);
      // original is unchanged (immutable)
      expect(published.status).toBe('published');
    });

    it('draft → published → draft round-trip preserves id and academyId', () => {
      const original = makeCourse({ status: 'draft' });
      const published = original.publish(now);
      const backToDraft = published.unpublish(now);
      expect(backToDraft.id).toBe(original.id);
      expect(backToDraft.academyId).toBe(original.academyId);
      expect(backToDraft.status).toBe('draft');
      expect(backToDraft.publishedAt).toBeNull();
    });
  });

  describe('slugFromTitle', () => {
    it('generates a valid slug from a title', () => {
      const slug = Course.slugFromTitle('Intro to TypeScript');
      expect(slug).toBe('intro-to-typescript');
    });

    it('strips special characters and normalizes to lowercase', () => {
      const slug = Course.slugFromTitle('My Course: 101!');
      expect(slug).toBe('my-course-101');
    });
  });
});

// ---------------------------------------------------------------------------
// CourseModule entity
// ---------------------------------------------------------------------------

describe('CourseModule', () => {
  it('can be instantiated with valid props', () => {
    const mod = new CourseModule({
      id: 'mod-1',
      courseId: 'course-1',
      academyId: 'org_A',
      title: 'Module 1',
      position: 1,
      createdAt: now,
      updatedAt: now,
    });
    expect(mod.id).toBe('mod-1');
    expect(mod.assessmentId).toBeNull();
  });

  it('throws when title is empty', () => {
    expect(() =>
      new CourseModule({
        id: 'mod-1',
        courseId: 'course-1',
        academyId: 'org_A',
        title: '',
        position: 1,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow('title is required');
  });
});

// ---------------------------------------------------------------------------
// Lesson entity
// ---------------------------------------------------------------------------

describe('Lesson', () => {
  it('can be instantiated as a video lesson', () => {
    const lesson = new Lesson({
      id: 'lesson-1',
      moduleId: 'mod-1',
      academyId: 'org_A',
      type: 'video',
      title: 'Getting Started',
      position: 1,
      content: {
        type: 'video',
        cloudflareUid: null,
        durationSeconds: null,
        thumbnailUrl: null,
      },
      createdAt: now,
      updatedAt: now,
    });
    expect(lesson.type).toBe('video');
    expect(lesson.content.type).toBe('video');
  });

  it('can be instantiated as a text lesson', () => {
    const lesson = new Lesson({
      id: 'lesson-2',
      moduleId: 'mod-1',
      academyId: 'org_A',
      type: 'text',
      title: 'Reading',
      position: 2,
      content: { type: 'text', body: { ops: [] } },
      createdAt: now,
      updatedAt: now,
    });
    expect(lesson.type).toBe('text');
  });

  it('throws when content.type does not match lesson type', () => {
    expect(() =>
      new Lesson({
        id: 'lesson-3',
        moduleId: 'mod-1',
        academyId: 'org_A',
        type: 'video',
        title: 'Bad lesson',
        position: 1,
        content: { type: 'text', body: null },
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow('does not match lesson type');
  });
});

// ---------------------------------------------------------------------------
// Enrollment entity
// ---------------------------------------------------------------------------

describe('Enrollment', () => {
  it('can be created directly when course is published', () => {
    const enrollment = Enrollment.enroll(makeEnrollmentProps(), 'published');
    expect(enrollment.id).toBe('enrollment-1');
    expect(enrollment.isCompleted).toBe(false);
  });

  it('throws CourseNotPublishedError when enrolling in a draft course', () => {
    expect(() => Enrollment.enroll(makeEnrollmentProps(), 'draft')).toThrow(
      CourseNotPublishedError,
    );
  });

  it('complete() returns a new immutable instance with completedAt set', () => {
    const enrollment = new Enrollment(makeEnrollmentProps());
    const completed = enrollment.complete(now);
    expect(completed.isCompleted).toBe(true);
    expect(completed.completedAt).toBe(now);
    // original unchanged
    expect(enrollment.isCompleted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LessonProgress entity
// ---------------------------------------------------------------------------

describe('LessonProgress', () => {
  it('can be instantiated with valid props', () => {
    const progress = new LessonProgress({
      id: 'progress-1',
      enrollmentId: 'enrollment-1',
      lessonId: 'lesson-1',
      academyId: 'org_A',
      completedAt: now,
    });
    expect(progress.lessonId).toBe('lesson-1');
    expect(progress.completedAt).toBe(now);
  });

  it('throws when enrollmentId is empty', () => {
    expect(() =>
      new LessonProgress({
        id: 'p-1',
        enrollmentId: '',
        lessonId: 'lesson-1',
        academyId: 'org_A',
        completedAt: now,
      }),
    ).toThrow('enrollmentId is required');
  });
});

// ---------------------------------------------------------------------------
// Assessment entity
// ---------------------------------------------------------------------------

describe('Assessment', () => {
  it('can be instantiated with opaque config', () => {
    const assessment = new Assessment({
      id: 'assess-1',
      moduleId: 'mod-1',
      academyId: 'org_A',
      title: 'Quiz 1',
      config: { type: 'quiz', questions: [] },
      createdAt: now,
      updatedAt: now,
    });
    expect(assessment.id).toBe('assess-1');
    expect(assessment.config).toEqual({ type: 'quiz', questions: [] });
  });

  it('throws when title is empty', () => {
    expect(() =>
      new Assessment({
        id: 'assess-1',
        moduleId: 'mod-1',
        academyId: 'org_A',
        title: '',
        config: null,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow('title is required');
  });
});

// ---------------------------------------------------------------------------
// Resource entity
// ---------------------------------------------------------------------------

describe('Resource', () => {
  it('can be instantiated with valid props', () => {
    const resource = new Resource({
      id: 'res-1',
      lessonId: 'lesson-1',
      academyId: 'org_A',
      type: 'link',
      title: 'MDN Docs',
      url: 'https://developer.mozilla.org',
      position: 1,
      createdAt: now,
    });
    expect(resource.type).toBe('link');
    expect(resource.url).toBe('https://developer.mozilla.org');
  });
});

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

describe('Domain errors', () => {
  it('SlugConflictError is an Error with the correct name', () => {
    const err = new SlugConflictError('my-slug', 'org_A');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('SlugConflictError');
    expect(err.message).toContain('my-slug');
  });

  it('CourseNotPublishedError is an Error with the correct name', () => {
    const err = new CourseNotPublishedError('course-1');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('CourseNotPublishedError');
    expect(err.message).toContain('course-1');
  });

  it('DuplicateEnrollmentError is an Error with the correct name', () => {
    const err = new DuplicateEnrollmentError('course-1', 'user_1');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DuplicateEnrollmentError');
  });

  it('DuplicateAssessmentError is an Error with the correct name', () => {
    const err = new DuplicateAssessmentError('mod-1');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DuplicateAssessmentError');
  });
});

// ---------------------------------------------------------------------------
// Value objects
// ---------------------------------------------------------------------------

describe('Slug VO (course domain)', () => {
  it('creates a valid slug', () => {
    const slug = Slug.create('my-course');
    expect(slug.value).toBe('my-course');
  });

  it('fromName normalizes a display name', () => {
    const slug = Slug.fromName('Intro to TypeScript!');
    expect(slug.value).toBe('intro-to-typescript');
  });

  it('throws on invalid slug', () => {
    expect(() => Slug.create('-bad')).toThrow('Invalid slug');
  });
});

describe('parseLessonType', () => {
  it('accepts video and text', () => {
    expect(parseLessonType('video')).toBe('video');
    expect(parseLessonType('text')).toBe('text');
  });

  it('throws on unknown value', () => {
    expect(() => parseLessonType('audio')).toThrow('Invalid lesson type');
  });
});

describe('parsePublicationStatus', () => {
  it('accepts draft and published', () => {
    expect(parsePublicationStatus('draft')).toBe('draft');
    expect(parsePublicationStatus('published')).toBe('published');
  });

  it('throws on unknown value', () => {
    expect(() => parsePublicationStatus('archived')).toThrow('Invalid publication status');
  });
});

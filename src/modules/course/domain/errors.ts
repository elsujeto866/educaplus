/**
 * Course domain errors.
 *
 * These are domain-layer invariant violations — not HTTP or infrastructure errors.
 * Use-cases and entities throw these; delivery/infra layers map them to appropriate
 * HTTP responses or log entries.
 *
 * Pure TS — zero imports.
 */

export class SlugConflictError extends Error {
  constructor(slug: string, academyId: string) {
    super(`Slug "${slug}" is already taken in academy "${academyId}"`);
    this.name = 'SlugConflictError';
  }
}

export class CourseNotPublishedError extends Error {
  constructor(courseId: string) {
    super(`Cannot enroll in course "${courseId}" — course must be published before enrollment is allowed`);
    this.name = 'CourseNotPublishedError';
  }
}

export class DuplicateEnrollmentError extends Error {
  constructor(courseId: string, clerkUserId: string) {
    super(`User "${clerkUserId}" is already enrolled in course "${courseId}"`);
    this.name = 'DuplicateEnrollmentError';
  }
}

export class DuplicateAssessmentError extends Error {
  constructor(courseId: string) {
    super(`Course "${courseId}" already has an assessment — upsert to replace it`);
    this.name = 'DuplicateAssessmentError';
  }
}

export class InvalidReorderError extends Error {
  constructor(id: string, scope: string) {
    super(`Item "${id}" does not belong to scope "${scope}"`);
    this.name = 'InvalidReorderError';
  }
}

export class InvalidQuizQuestionError extends Error {
  constructor(reason: string) {
    super(`Invalid quiz question: ${reason}`);
    this.name = 'InvalidQuizQuestionError';
  }
}

export class InvalidAssessmentError extends Error {
  constructor(reason: string) {
    super(`Invalid assessment: ${reason}`);
    this.name = 'InvalidAssessmentError';
  }
}

export class CourseNotFoundError extends Error {
  constructor(courseId: string) {
    super(`Course "${courseId}" does not exist or does not belong to the caller's academy`);
    this.name = 'CourseNotFoundError';
  }
}

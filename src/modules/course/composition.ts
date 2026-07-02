import { DrizzleCourseRepository } from './infrastructure/drizzle-course.repository';
import { DrizzleCourseModuleRepository } from './infrastructure/drizzle-course-module.repository';
import { DrizzleLessonRepository } from './infrastructure/drizzle-lesson.repository';
import { DrizzleLessonProgressRepository } from './infrastructure/drizzle-lesson-progress.repository';
import { DrizzleResourceRepository } from './infrastructure/drizzle-resource.repository';
import { DrizzleEnrollmentRepository } from './infrastructure/drizzle-enrollment.repository';
import { DrizzleAssessmentRepository } from './infrastructure/drizzle-assessment.repository';
import { DrizzleAssessmentAttemptRepository } from './infrastructure/drizzle-assessment-attempt.repository';
import { DrizzleProgressQuery } from './infrastructure/drizzle-progress-query';
import { CreateCourseUseCase } from './application/create-course.use-case';
import { ListCoursesUseCase } from './application/list-courses.use-case';
import { ListPublishedCoursesUseCase } from './application/list-published-courses.use-case';
import { ListMyEnrollmentsUseCase } from './application/list-my-enrollments.use-case';
import { GetEnrolledCourseUseCase } from './application/get-enrolled-course.use-case';
import { GetCourseDetailUseCase } from './application/get-course-detail.use-case';
export type { EnrolledCourseView } from './application/get-enrolled-course.use-case';
export type { CourseDetailView } from './application/get-course-detail.use-case';
import { GetLessonUseCase } from './application/get-lesson.use-case';
import { UpdateCourseUseCase } from './application/update-course.use-case';
import { PublishCourseUseCase } from './application/publish-course.use-case';
import { UnpublishCourseUseCase } from './application/unpublish-course.use-case';
import { DeleteCourseUseCase } from './application/delete-course.use-case';
import { AddModuleUseCase } from './application/add-module.use-case';
import { ReorderModulesUseCase } from './application/reorder-modules.use-case';
import { AddLessonUseCase } from './application/add-lesson.use-case';
import { ReorderLessonsUseCase } from './application/reorder-lessons.use-case';
import { UpdateLessonBodyUseCase } from './application/update-lesson-body.use-case';
import { AddResourceUseCase } from './application/add-resource.use-case';
import { RemoveResourceUseCase } from './application/remove-resource.use-case';
import { EnrollLearnerUseCase } from './application/enroll-learner.use-case';
import { MarkLessonCompleteUseCase } from './application/mark-lesson-complete.use-case';
import { GetCourseProgressUseCase } from './application/get-course-progress.use-case';
import { UpsertAssessmentUseCase } from './application/upsert-assessment.use-case';
import { GetAssessmentUseCase } from './application/get-assessment.use-case';
export type { AssessmentView } from './application/get-assessment.use-case';
import { SubmitAttemptUseCase } from './application/submit-attempt.use-case';
import { GetAttemptsUseCase, GetLatestPassedUseCase } from './application/get-attempts.use-case';

export interface CourseComposition {
  createCourse: CreateCourseUseCase;
  listCourses: ListCoursesUseCase;
  listPublishedCourses: ListPublishedCoursesUseCase;
  listMyEnrollments: ListMyEnrollmentsUseCase;
  getEnrolledCourse: GetEnrolledCourseUseCase;
  getCourseDetail: GetCourseDetailUseCase;
  getLesson: GetLessonUseCase;
  updateCourse: UpdateCourseUseCase;
  publishCourse: PublishCourseUseCase;
  unpublishCourse: UnpublishCourseUseCase;
  deleteCourse: DeleteCourseUseCase;
  addModule: AddModuleUseCase;
  reorderModules: ReorderModulesUseCase;
  addLesson: AddLessonUseCase;
  reorderLessons: ReorderLessonsUseCase;
  updateLessonBody: UpdateLessonBodyUseCase;
  addResource: AddResourceUseCase;
  removeResource: RemoveResourceUseCase;
  enrollLearner: EnrollLearnerUseCase;
  markLessonComplete: MarkLessonCompleteUseCase;
  getCourseProgress: GetCourseProgressUseCase;
  upsertAssessment: UpsertAssessmentUseCase;
  getAssessment: GetAssessmentUseCase;
  submitAttempt: SubmitAttemptUseCase;
  getAttempts: GetAttemptsUseCase;
  getLatestPassed: GetLatestPassedUseCase;
}

/**
 * Factory function — explicit DI wiring, no IoC container.
 *
 * Call once per request (or cache at module scope for connection reuse).
 * The composition object owns the use-case instances; repos are created fresh
 * per call so their lifecycle mirrors the request scope.
 *
 * Mirrors the academy composition pattern exactly.
 */
export function makeCourseComposition(): CourseComposition {
  const courseRepo = new DrizzleCourseRepository();
  const moduleRepo = new DrizzleCourseModuleRepository();
  const lessonRepo = new DrizzleLessonRepository();
  const lessonProgressRepo = new DrizzleLessonProgressRepository();
  const resourceRepo = new DrizzleResourceRepository();
  const enrollmentRepo = new DrizzleEnrollmentRepository();
  const assessmentRepo = new DrizzleAssessmentRepository();
  const attemptRepo = new DrizzleAssessmentAttemptRepository();
  const progressQuery = new DrizzleProgressQuery();

  return {
    createCourse: new CreateCourseUseCase(courseRepo),
    listCourses: new ListCoursesUseCase(courseRepo),
    listPublishedCourses: new ListPublishedCoursesUseCase(courseRepo),
    listMyEnrollments: new ListMyEnrollmentsUseCase(enrollmentRepo),
    getEnrolledCourse: new GetEnrolledCourseUseCase(
      courseRepo,
      moduleRepo,
      lessonRepo,
      enrollmentRepo,
      lessonProgressRepo,
      progressQuery,
    ),
    getCourseDetail: new GetCourseDetailUseCase(courseRepo, moduleRepo, lessonRepo),
    getLesson: new GetLessonUseCase(lessonRepo),
    updateCourse: new UpdateCourseUseCase(courseRepo),
    publishCourse: new PublishCourseUseCase(courseRepo),
    unpublishCourse: new UnpublishCourseUseCase(courseRepo),
    deleteCourse: new DeleteCourseUseCase(courseRepo),
    addModule: new AddModuleUseCase(moduleRepo),
    reorderModules: new ReorderModulesUseCase(moduleRepo),
    addLesson: new AddLessonUseCase(lessonRepo),
    reorderLessons: new ReorderLessonsUseCase(lessonRepo),
    updateLessonBody: new UpdateLessonBodyUseCase(lessonRepo),
    addResource: new AddResourceUseCase(resourceRepo),
    removeResource: new RemoveResourceUseCase(resourceRepo),
    enrollLearner: new EnrollLearnerUseCase(courseRepo, enrollmentRepo),
    markLessonComplete: new MarkLessonCompleteUseCase(
      lessonProgressRepo,
      enrollmentRepo,
      progressQuery,
    ),
    getCourseProgress: new GetCourseProgressUseCase(progressQuery),
    upsertAssessment: new UpsertAssessmentUseCase(assessmentRepo, courseRepo),
    getAssessment: new GetAssessmentUseCase(assessmentRepo),
    submitAttempt: new SubmitAttemptUseCase(assessmentRepo, enrollmentRepo, attemptRepo),
    getAttempts: new GetAttemptsUseCase(assessmentRepo, attemptRepo),
    getLatestPassed: new GetLatestPassedUseCase(assessmentRepo, attemptRepo),
  };
}

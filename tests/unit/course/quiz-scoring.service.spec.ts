import { describe, it, expect } from 'vitest';
import {
  assertAnswersValid,
  score,
} from '../../../src/modules/course/domain/services/quiz-scoring.service';
import { Assessment } from '../../../src/modules/course/domain/assessment.entity';
import { QuizQuestionFactory } from '../../../src/modules/course/domain/value-objects/quiz-question.vo';
import { EmptyQuizError, InvalidAttemptError } from '../../../src/modules/course/domain/errors';

const now = new Date('2025-01-01T00:00:00Z');

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return QuizQuestionFactory.create({
    type: 'single',
    id: overrides['id'] as string ?? 'q-1',
    prompt: overrides['prompt'] as string ?? 'What is 2 + 2?',
    options: (overrides['options'] as { id: string; label: string }[]) ?? [
      { id: 'opt-1', label: '3' },
      { id: 'opt-2', label: '4' },
    ],
    correctOptionId: overrides['correctOptionId'] as string ?? 'opt-2',
  });
}

function makeAssessment(overrides: Partial<ConstructorParameters<typeof Assessment>[0]> = {}) {
  return new Assessment({
    id: 'assess-1',
    courseId: 'course-1',
    academyId: 'org_A',
    title: 'Quiz 1',
    passingScore: 70,
    questions: [
      makeQuestion({ id: 'q-1', correctOptionId: 'opt-2' }),
      makeQuestion({
        id: 'q-2',
        options: [
          { id: 'opt-3', label: '3' },
          { id: 'opt-4', label: '4' },
        ],
        correctOptionId: 'opt-4',
      }),
      makeQuestion({
        id: 'q-3',
        options: [
          { id: 'opt-5', label: 'Yes' },
          { id: 'opt-6', label: 'No' },
        ],
        correctOptionId: 'opt-5',
      }),
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('quiz-scoring.service — score()', () => {
  it('scores 100 when all answers are correct', () => {
    const assessment = makeAssessment();
    const result = score(assessment, [
      { questionId: 'q-1', selectedOptionId: 'opt-2' },
      { questionId: 'q-2', selectedOptionId: 'opt-4' },
      { questionId: 'q-3', selectedOptionId: 'opt-5' },
    ]);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('scores 0 when all answers are wrong', () => {
    const assessment = makeAssessment();
    const result = score(assessment, [
      { questionId: 'q-1', selectedOptionId: 'opt-1' },
      { questionId: 'q-2', selectedOptionId: 'opt-3' },
      { questionId: 'q-3', selectedOptionId: 'opt-6' },
    ]);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('rounds partial correctness: 2 of 3 correct = round(66.67) = 67', () => {
    const assessment = makeAssessment();
    const result = score(assessment, [
      { questionId: 'q-1', selectedOptionId: 'opt-2' },
      { questionId: 'q-2', selectedOptionId: 'opt-4' },
      { questionId: 'q-3', selectedOptionId: 'opt-6' },
    ]);
    expect(result.score).toBe(67);
    expect(result.passed).toBe(false);
  });

  it('passes when score exactly equals passingScore (>=, not >)', () => {
    // 2 questions, 1 correct = 50%, passingScore 50 → passed
    const assessment = makeAssessment({
      passingScore: 50,
      questions: [
        makeQuestion({ id: 'q-1', correctOptionId: 'opt-2' }),
        makeQuestion({
          id: 'q-2',
          options: [
            { id: 'opt-3', label: '3' },
            { id: 'opt-4', label: '4' },
          ],
          correctOptionId: 'opt-4',
        }),
      ],
    });
    const result = score(assessment, [
      { questionId: 'q-1', selectedOptionId: 'opt-2' },
      { questionId: 'q-2', selectedOptionId: 'opt-3' },
    ]);
    expect(result.score).toBe(50);
    expect(result.passed).toBe(true);
  });

  it('fails when score is just below passingScore', () => {
    const assessment = makeAssessment({ passingScore: 70 });
    const result = score(assessment, [
      { questionId: 'q-1', selectedOptionId: 'opt-2' },
      { questionId: 'q-2', selectedOptionId: 'opt-3' },
      { questionId: 'q-3', selectedOptionId: 'opt-6' },
    ]);
    expect(result.score).toBe(33);
    expect(result.passed).toBe(false);
  });

  it('throws EmptyQuizError when the assessment has zero questions', () => {
    const assessment = makeAssessment({ questions: [] });
    expect(() => score(assessment, [])).toThrow(EmptyQuizError);
  });
});

describe('quiz-scoring.service — assertAnswersValid()', () => {
  it('does not throw for a fully valid set of answers', () => {
    const assessment = makeAssessment();
    expect(() =>
      assertAnswersValid(assessment, [
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-2', selectedOptionId: 'opt-4' },
        { questionId: 'q-3', selectedOptionId: 'opt-5' },
      ]),
    ).not.toThrow();
  });

  it('throws InvalidAttemptError for an unknown questionId', () => {
    const assessment = makeAssessment();
    expect(() =>
      assertAnswersValid(assessment, [{ questionId: 'q-unknown', selectedOptionId: 'opt-2' }]),
    ).toThrow(InvalidAttemptError);
  });

  it('throws InvalidAttemptError for an unknown optionId on a known question', () => {
    const assessment = makeAssessment();
    expect(() =>
      assertAnswersValid(assessment, [{ questionId: 'q-1', selectedOptionId: 'opt-unknown' }]),
    ).toThrow(InvalidAttemptError);
  });

  it('throws InvalidAttemptError when the same questionId is answered more than once', () => {
    const assessment = makeAssessment();
    expect(() =>
      assertAnswersValid(assessment, [
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-1', selectedOptionId: 'opt-1' },
        { questionId: 'q-2', selectedOptionId: 'opt-4' },
        { questionId: 'q-3', selectedOptionId: 'opt-5' },
      ]),
    ).toThrow(InvalidAttemptError);
  });

  it('rejects the certificate-forgery exploit: one known-correct answer repeated for every question', () => {
    // A student who only knows q-1's correct answer submits it 3 times on a
    // 3-question quiz. Without dedup this would score 100/passed=true.
    const assessment = makeAssessment();
    expect(() =>
      assertAnswersValid(assessment, [
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
      ]),
    ).toThrow(InvalidAttemptError);
  });

  it('throws InvalidAttemptError for partial answers (fewer answers than questions)', () => {
    const assessment = makeAssessment();
    expect(() =>
      assertAnswersValid(assessment, [
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-2', selectedOptionId: 'opt-4' },
      ]),
    ).toThrow(InvalidAttemptError);
  });

  it('throws InvalidAttemptError for an unanswered assessment (zero answers, non-empty quiz)', () => {
    const assessment = makeAssessment();
    expect(() => assertAnswersValid(assessment, [])).toThrow(InvalidAttemptError);
  });
});

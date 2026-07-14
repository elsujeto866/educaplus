/**
 * QuestionList RSC-serialization regression test.
 *
 * Production crash: `GetBankDetailUseCase` returns `Question` DOMAIN ENTITY
 * instances (`detail.questions`); `BankDetailPage` (Server Component) passes
 * them straight through `QuestionList` into `QuestionRow` (`'use client'`).
 * React Server Components can only serialize PLAIN objects across the
 * server->client boundary — passing a class instance throws at render time
 * ("Only plain objects... Classes or null prototypes are not supported").
 * This only crashes once a bank has >=1 question, so it slipped past the
 * empty-state page load and past unit tests using plain-object mocks.
 *
 * This test locks the fix: `QuestionList` must map each `Question` entity to
 * a plain object literal (matching `QuestionRowData`) BEFORE it reaches the
 * client `QuestionRow` island.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Question } from '../../../src/modules/simulator/domain/question.entity';

const receivedQuestions: unknown[] = [];

vi.mock('../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-row', () => ({
  QuestionRow: (props: { question: unknown }) => {
    receivedQuestions.push(props.question);
    return null;
  },
}));

function makeQuestionEntity(): Question {
  return new Question({
    id: 'question-1',
    bankId: 'bank-1',
    academyId: 'academy-1',
    prompt: '¿Cuánto es 2 + 2?',
    options: [
      { id: 'opt-a', label: '3' },
      { id: 'opt-b', label: '4' },
    ],
    correctOptionId: 'opt-b',
    topic: 'aritmética',
    difficulty: 'easy',
    explanation: 'Suma básica.',
    position: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('QuestionList', () => {
  it('maps Question domain entities to plain objects before reaching the client QuestionRow', async () => {
    receivedQuestions.length = 0;
    const { QuestionList } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-list'
    );

    const question = makeQuestionEntity();
    render(<QuestionList bankId="bank-1" questions={[question]} />);

    expect(receivedQuestions).toHaveLength(1);
    const passed = receivedQuestions[0];

    // A `Question` instance would fail BOTH assertions below — that is
    // exactly the RSC serialization crash this test guards against.
    expect(passed).not.toBeInstanceOf(Question);
    expect(Object.getPrototypeOf(passed)).toBe(Object.prototype);

    expect(passed).toEqual({
      id: 'question-1',
      prompt: '¿Cuánto es 2 + 2?',
      topic: 'aritmética',
      difficulty: 'easy',
      explanation: 'Suma básica.',
      options: [
        { id: 'opt-a', label: '3' },
        { id: 'opt-b', label: '4' },
      ],
      correctOptionId: 'opt-b',
    });
  });

  it('renders the empty-state card when there are no questions (unaffected by the fix)', async () => {
    const { QuestionList } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-list'
    );

    const { getByText } = render(<QuestionList bankId="bank-1" questions={[]} />);

    expect(getByText('Este banco todavía no tiene preguntas')).toBeTruthy();
  });
});

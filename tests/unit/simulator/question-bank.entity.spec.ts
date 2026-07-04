import { describe, it, expect } from 'vitest';
import { QuestionBank } from '../../../src/modules/simulator/domain/question-bank.entity';
import { InvalidQuestionBankError } from '../../../src/modules/simulator/domain/errors';

const now = new Date('2025-01-01T00:00:00Z');

function makeProps(
  overrides: Partial<ConstructorParameters<typeof QuestionBank>[0]> = {},
): ConstructorParameters<typeof QuestionBank>[0] {
  return {
    id: 'bank-1',
    academyId: 'org_A',
    title: 'General Knowledge',
    description: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('QuestionBank', () => {
  it('can be instantiated with valid props', () => {
    const bank = new QuestionBank(makeProps());
    expect(bank.id).toBe('bank-1');
    expect(bank.academyId).toBe('org_A');
    expect(bank.title).toBe('General Knowledge');
    expect(bank.description).toBeNull();
    expect(bank.createdAt).toBe(now);
    expect(bank.updatedAt).toBe(now);
  });

  it('throws when id is missing', () => {
    expect(() => new QuestionBank(makeProps({ id: '' }))).toThrow(/id is required/);
  });

  it('throws when academyId is missing', () => {
    expect(() => new QuestionBank(makeProps({ academyId: '' }))).toThrow(/academyId is required/);
  });

  it('throws InvalidQuestionBankError when title is empty', () => {
    expect(() => new QuestionBank(makeProps({ title: '' }))).toThrow(InvalidQuestionBankError);
  });

  it('throws InvalidQuestionBankError when title is whitespace-only', () => {
    expect(() => new QuestionBank(makeProps({ title: '   ' }))).toThrow(InvalidQuestionBankError);
  });

  it('accepts an optional description', () => {
    const bank = new QuestionBank(makeProps({ description: 'Covers arithmetic and history' }));
    expect(bank.description).toBe('Covers arithmetic and history');
  });

  it('defaults description to null when omitted', () => {
    const bank = new QuestionBank({
      id: 'bank-1',
      academyId: 'org_A',
      title: 'General Knowledge',
      createdAt: now,
      updatedAt: now,
    });
    expect(bank.description).toBeNull();
  });
});

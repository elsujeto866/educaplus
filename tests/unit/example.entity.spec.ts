import { describe, it, expect } from 'vitest';
import { ExampleEntity } from '../../src/modules/_example/domain/example.entity';

describe('ExampleEntity', () => {
  it('can be instantiated with a valid id and name', () => {
    const entity = new ExampleEntity('abc-123', 'Test Example');
    expect(entity.id).toBe('abc-123');
    expect(entity.name).toBe('Test Example');
  });

  it('throws when id is empty', () => {
    expect(() => new ExampleEntity('', 'Test')).toThrow('id is required');
  });
});

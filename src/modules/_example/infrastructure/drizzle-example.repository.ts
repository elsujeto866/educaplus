import type { ExampleRepository } from '../domain/ports/example.repository';
import type { ExampleEntity } from '../domain/example.entity';

export class DrizzleExampleRepository implements ExampleRepository {
  async findById(_id: string): Promise<ExampleEntity | null> {
    throw new Error('NotImplemented: DrizzleExampleRepository.findById');
  }
}

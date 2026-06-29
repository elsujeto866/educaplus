import type { ExampleRepository } from '../domain/ports/example.repository';
import type { ExampleEntity } from '../domain/example.entity';

export class GetExampleUseCase {
  constructor(private readonly repo: ExampleRepository) {}

  async execute(id: string): Promise<ExampleEntity | null> {
    return this.repo.findById(id);
  }
}

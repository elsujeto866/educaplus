import type { ExampleEntity } from '../example.entity';

export interface ExampleRepository {
  findById(id: string): Promise<ExampleEntity | null>;
}

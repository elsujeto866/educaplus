import { GetExampleUseCase } from './application/get-example.use-case';
import { DrizzleExampleRepository } from './infrastructure/drizzle-example.repository';

export function buildGetExampleUseCase(): GetExampleUseCase {
  const repo = new DrizzleExampleRepository();
  return new GetExampleUseCase(repo);
}

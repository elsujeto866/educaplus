import { DrizzleQuestionBankRepository } from './infrastructure/drizzle-question-bank.repository';
import { DrizzleQuestionRepository } from './infrastructure/drizzle-question.repository';
import { DrizzleSimulatorRepository } from './infrastructure/drizzle-simulator.repository';
import { CreateBankUseCase } from './application/create-bank.use-case';
import { UpdateBankUseCase } from './application/update-bank.use-case';
import { DeleteBankUseCase } from './application/delete-bank.use-case';
import { ListBanksUseCase } from './application/list-banks.use-case';
import { GetBankDetailUseCase } from './application/get-bank-detail.use-case';
export type { BankDetailView } from './application/get-bank-detail.use-case';
import { AddQuestionUseCase } from './application/add-question.use-case';
import { UpdateQuestionUseCase } from './application/update-question.use-case';
import { DeleteQuestionUseCase } from './application/delete-question.use-case';
import { CreateSimulatorUseCase } from './application/create-simulator.use-case';
import { UpdateSimulatorUseCase } from './application/update-simulator.use-case';
import { PublishSimulatorUseCase } from './application/publish-simulator.use-case';
import { UnpublishSimulatorUseCase } from './application/unpublish-simulator.use-case';
import { ListSimulatorsUseCase } from './application/list-simulators.use-case';
import { GetSimulatorUseCase } from './application/get-simulator.use-case';
import { ListPublishedSimulatorsUseCase } from './application/list-published-simulators.use-case';
import { GetPublishedSimulatorUseCase } from './application/get-published-simulator.use-case';

export interface SimulatorComposition {
  createBank: CreateBankUseCase;
  updateBank: UpdateBankUseCase;
  deleteBank: DeleteBankUseCase;
  listBanks: ListBanksUseCase;
  getBankDetail: GetBankDetailUseCase;
  addQuestion: AddQuestionUseCase;
  updateQuestion: UpdateQuestionUseCase;
  deleteQuestion: DeleteQuestionUseCase;
  createSimulator: CreateSimulatorUseCase;
  updateSimulator: UpdateSimulatorUseCase;
  publishSimulator: PublishSimulatorUseCase;
  unpublishSimulator: UnpublishSimulatorUseCase;
  listSimulators: ListSimulatorsUseCase;
  getSimulator: GetSimulatorUseCase;
  listPublishedSimulators: ListPublishedSimulatorsUseCase;
  getPublishedSimulator: GetPublishedSimulatorUseCase;
}

/**
 * Factory function — explicit DI wiring, no IoC container.
 *
 * Call once per request (or cache at module scope for connection reuse).
 * The composition object owns the use-case instances; repos are created
 * fresh per call so their lifecycle mirrors the request scope. Mirrors
 * `makeCourseComposition()` exactly.
 */
export function makeSimulatorComposition(): SimulatorComposition {
  const bankRepo = new DrizzleQuestionBankRepository();
  const questionRepo = new DrizzleQuestionRepository();
  const simulatorRepo = new DrizzleSimulatorRepository();

  return {
    createBank: new CreateBankUseCase(bankRepo),
    updateBank: new UpdateBankUseCase(bankRepo),
    deleteBank: new DeleteBankUseCase(bankRepo),
    listBanks: new ListBanksUseCase(bankRepo),
    getBankDetail: new GetBankDetailUseCase(bankRepo, questionRepo),
    addQuestion: new AddQuestionUseCase(questionRepo),
    updateQuestion: new UpdateQuestionUseCase(questionRepo),
    deleteQuestion: new DeleteQuestionUseCase(questionRepo),
    createSimulator: new CreateSimulatorUseCase(simulatorRepo, bankRepo),
    updateSimulator: new UpdateSimulatorUseCase(simulatorRepo),
    publishSimulator: new PublishSimulatorUseCase(simulatorRepo, questionRepo),
    unpublishSimulator: new UnpublishSimulatorUseCase(simulatorRepo),
    listSimulators: new ListSimulatorsUseCase(simulatorRepo),
    getSimulator: new GetSimulatorUseCase(simulatorRepo),
    listPublishedSimulators: new ListPublishedSimulatorsUseCase(simulatorRepo),
    getPublishedSimulator: new GetPublishedSimulatorUseCase(simulatorRepo),
  };
}

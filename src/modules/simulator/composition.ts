import { DrizzleQuestionBankRepository } from './infrastructure/drizzle-question-bank.repository';
import { DrizzleQuestionRepository } from './infrastructure/drizzle-question.repository';
import { DrizzleSimulatorRepository } from './infrastructure/drizzle-simulator.repository';
import { DrizzleSimulatorAttemptRepository } from './infrastructure/drizzle-simulator-attempt.repository';
import { DrizzleSimulatorCertificateRepository } from './infrastructure/drizzle-simulator-certificate.repository';
import { DrizzleSimulatorTrackRepository } from './infrastructure/drizzle-simulator-track.repository';
import { DrizzleSimulatorTrackStepRepository } from './infrastructure/drizzle-simulator-track-step.repository';
import { DrizzleSimulatorTrackProgressRepository } from './infrastructure/drizzle-simulator-track-progress.repository';
import { CryptoRandomAdapter } from './infrastructure/crypto-random.adapter';
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
import { StartAttemptUseCase } from './application/start-attempt.use-case';
import { SubmitAttemptUseCase } from './application/submit-attempt.use-case';
import { GetAttemptUseCase } from './application/get-attempt.use-case';
import { IssueSimulatorCertificateUseCase } from './application/issue-simulator-certificate.use-case';
import { CreateTrackUseCase } from './application/create-track.use-case';
import { AddSimulatorToTrackStepUseCase } from './application/add-simulator-to-track-step.use-case';
import { ReorderTrackStepsUseCase } from './application/reorder-track-steps.use-case';
import { RemoveTrackStepUseCase } from './application/remove-track-step.use-case';
import { ListTracksUseCase } from './application/list-tracks.use-case';
import { GetTrackDetailUseCase } from './application/get-track-detail.use-case';
import { PublishTrackUseCase } from './application/publish-track.use-case';
import { UnpublishTrackUseCase } from './application/unpublish-track.use-case';
export type { TrackDetailView } from './application/get-track-detail.use-case';
import { AdvanceProgressOnPassUseCase } from './application/advance-progress-on-pass.use-case';
import { GetTrackForLearnerUseCase } from './application/get-track-for-learner.use-case';
export type { TrackForLearnerView, TrackStepView, TrackStepStatus } from './application/get-track-for-learner.use-case';
import { ImportQuestionsFromCsvUseCase } from './application/import-questions-from-csv.use-case';
import { Rfc4180CsvQuestionSource } from './infrastructure/rfc4180-csv-question-source.adapter';

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
  startAttempt: StartAttemptUseCase;
  submitAttempt: SubmitAttemptUseCase;
  getAttempt: GetAttemptUseCase;
  issueSimulatorCertificate: IssueSimulatorCertificateUseCase;
  createTrack: CreateTrackUseCase;
  addSimulatorToTrackStep: AddSimulatorToTrackStepUseCase;
  reorderTrackSteps: ReorderTrackStepsUseCase;
  removeTrackStep: RemoveTrackStepUseCase;
  listTracks: ListTracksUseCase;
  getTrackDetail: GetTrackDetailUseCase;
  publishTrack: PublishTrackUseCase;
  unpublishTrack: UnpublishTrackUseCase;
  advanceProgressOnPass: AdvanceProgressOnPassUseCase;
  getTrackForLearner: GetTrackForLearnerUseCase;
  importQuestionsFromCsv: ImportQuestionsFromCsvUseCase;
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
  const attemptRepo = new DrizzleSimulatorAttemptRepository();
  const certificateRepo = new DrizzleSimulatorCertificateRepository();
  const trackRepo = new DrizzleSimulatorTrackRepository();
  const trackStepRepo = new DrizzleSimulatorTrackStepRepository();
  const trackProgressRepo = new DrizzleSimulatorTrackProgressRepository();
  const rng = new CryptoRandomAdapter();
  const advanceProgressOnPassUseCase = new AdvanceProgressOnPassUseCase(
    trackStepRepo,
    attemptRepo,
    trackProgressRepo,
  );
  const csvSource = new Rfc4180CsvQuestionSource();

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
    startAttempt: new StartAttemptUseCase(simulatorRepo, questionRepo, attemptRepo, rng),
    submitAttempt: new SubmitAttemptUseCase(attemptRepo, simulatorRepo),
    getAttempt: new GetAttemptUseCase(attemptRepo, simulatorRepo),
    issueSimulatorCertificate: new IssueSimulatorCertificateUseCase(attemptRepo, certificateRepo),
    createTrack: new CreateTrackUseCase(trackRepo),
    addSimulatorToTrackStep: new AddSimulatorToTrackStepUseCase(trackRepo, trackStepRepo, simulatorRepo),
    reorderTrackSteps: new ReorderTrackStepsUseCase(trackRepo, trackStepRepo),
    removeTrackStep: new RemoveTrackStepUseCase(trackRepo, trackStepRepo),
    listTracks: new ListTracksUseCase(trackRepo),
    getTrackDetail: new GetTrackDetailUseCase(trackRepo, trackStepRepo),
    publishTrack: new PublishTrackUseCase(trackRepo, trackStepRepo),
    unpublishTrack: new UnpublishTrackUseCase(trackRepo),
    advanceProgressOnPass: advanceProgressOnPassUseCase,
    getTrackForLearner: new GetTrackForLearnerUseCase(
      trackRepo,
      trackStepRepo,
      trackProgressRepo,
      advanceProgressOnPassUseCase,
    ),
    importQuestionsFromCsv: new ImportQuestionsFromCsvUseCase(questionRepo, csvSource, bankRepo),
  };
}

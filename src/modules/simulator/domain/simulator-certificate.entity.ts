import { InvalidSimulatorCertificateError } from './errors';

export interface SimulatorCertificateProps {
  id: string;
  simulatorId: string;
  academyId: string;
  clerkUserId: string;
  certificateCode: string;
  /** Percentage score (0-100, integer) snapshotted from the passing attempt. */
  score: number;
  /** Snapshot of the learner's display name at issuance time. */
  studentName: string;
  /** Snapshot of the simulator title at issuance time. */
  simulatorTitle: string;
  /** Snapshot of the academy name at issuance time. */
  academyName: string;
  issuedAt: Date;
}

/**
 * SimulatorCertificate entity — an immutable proof-of-pass credential for a
 * simulator, mirroring `modules/course/domain/certificate.entity.ts`
 * verbatim (Slice S5 / design Decision 8). Once issued it never changes:
 * all fields are readonly and IssueSimulatorCertificateUseCase never
 * updates an existing row — studentName/simulatorTitle/academyName are
 * snapshots taken at issuance time.
 *
 * Pure TS — zero infrastructure imports.
 */
export class SimulatorCertificate {
  readonly id: string;
  readonly simulatorId: string;
  readonly academyId: string;
  readonly clerkUserId: string;
  readonly certificateCode: string;
  readonly score: number;
  readonly studentName: string;
  readonly simulatorTitle: string;
  readonly academyName: string;
  readonly issuedAt: Date;

  constructor(props: SimulatorCertificateProps) {
    if (!props.id) throw new Error('SimulatorCertificate: id is required');
    if (!props.simulatorId) throw new Error('SimulatorCertificate: simulatorId is required');
    if (!props.academyId) throw new Error('SimulatorCertificate: academyId is required');
    if (!props.clerkUserId) throw new Error('SimulatorCertificate: clerkUserId is required');
    if (!props.certificateCode) {
      throw new Error('SimulatorCertificate: certificateCode is required');
    }
    if (!props.studentName) throw new Error('SimulatorCertificate: studentName is required');
    if (!props.simulatorTitle) {
      throw new Error('SimulatorCertificate: simulatorTitle is required');
    }
    if (!props.academyName) throw new Error('SimulatorCertificate: academyName is required');
    if (!Number.isInteger(props.score) || props.score < 0 || props.score > 100) {
      throw new InvalidSimulatorCertificateError('score must be an integer between 0 and 100');
    }

    this.id = props.id;
    this.simulatorId = props.simulatorId;
    this.academyId = props.academyId;
    this.clerkUserId = props.clerkUserId;
    this.certificateCode = props.certificateCode;
    this.score = props.score;
    this.studentName = props.studentName;
    this.simulatorTitle = props.simulatorTitle;
    this.academyName = props.academyName;
    this.issuedAt = props.issuedAt;
  }
}

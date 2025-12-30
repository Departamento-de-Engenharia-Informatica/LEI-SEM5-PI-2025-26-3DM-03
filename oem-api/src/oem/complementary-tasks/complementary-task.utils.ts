import {
  ComplementaryTaskMode,
  ComplementaryTaskStatus,
} from '../domain/complementary-task.entity';

export function deriveTaskStatus(endTime?: Date | null): ComplementaryTaskStatus {
  return endTime ? ComplementaryTaskStatus.COMPLETED : ComplementaryTaskStatus.ONGOING;
}

export function isImpactingNow(
  mode: ComplementaryTaskMode,
  status: ComplementaryTaskStatus,
): boolean {
  return status === ComplementaryTaskStatus.ONGOING && mode === ComplementaryTaskMode.SUSPENDS;
}

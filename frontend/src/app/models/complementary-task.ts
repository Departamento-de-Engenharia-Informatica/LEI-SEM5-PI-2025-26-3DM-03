export type ComplementaryTaskMode = 'PARALLEL' | 'SUSPENDS';
export type ComplementaryTaskStatus = 'ONGOING' | 'COMPLETED';

export interface ComplementaryTaskDTO {
  id: number;
  identifier: string;
  categoryId: number;
  vveId: number;
  team: string;
  mode: ComplementaryTaskMode;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  status: ComplementaryTaskStatus;
  isImpactingNow: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComplementaryTaskDTO {
  categoryId: number;
  vveId: number;
  team: string;
  mode: ComplementaryTaskMode;
  startTime: string;
  endTime?: string;
}

export interface UpdateComplementaryTaskDTO {
  categoryId?: number;
  team?: string;
  mode?: ComplementaryTaskMode;
  startTime?: string;
  endTime?: string | null;
}

export interface ComplementaryTaskFilters {
  vveId?: number;
  vesselIdentifier?: string;
  status?: ComplementaryTaskStatus;
  from?: string;
  to?: string;
}

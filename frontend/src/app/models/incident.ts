export type IncidentSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';
export type IncidentStatus = 'ACTIVE' | 'RESOLVED';
export type IncidentScope = 'ALL_ONGOING' | 'SPECIFIC' | 'UPCOMING';

export interface IncidentTypeSummaryDTO {
  id: number;
  code: string;
  name: string;
}

export interface IncidentDTO {
  id: number;
  identifier: string;
  incidentTypeId: number;
  incidentType?: IncidentTypeSummaryDTO | null;
  severity: IncidentSeverity;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  scope: IncidentScope;
  impactFrom?: string | null;
  impactTo?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: IncidentStatus;
  isImpactingNow?: boolean;
  affectedVveIds?: number[] | null;
}

export interface CreateIncidentDTO {
  incidentTypeId: number;
  severity: IncidentSeverity;
  startTime: string;
  endTime?: string | null;
  description?: string | null;
  scope: IncidentScope;
  impactFrom?: string | null;
  impactTo?: string | null;
  affectedVveIds?: number[];
}

export interface UpdateIncidentDTO {
  incidentTypeId?: number;
  severity?: IncidentSeverity;
  startTime?: string;
  endTime?: string | null;
  description?: string | null;
  scope?: IncidentScope;
  impactFrom?: string | null;
  impactTo?: string | null;
}

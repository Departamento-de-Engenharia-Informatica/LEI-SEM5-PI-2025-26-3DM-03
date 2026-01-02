export enum IncidentSeverity {
  MINOR = 'MINOR',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

export interface IncidentTypeDTO {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  severity: IncidentSeverity;
  parentId?: number | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface IncidentTypeTreeDTO extends IncidentTypeDTO {
  children?: IncidentTypeTreeDTO[];
}

export interface CreateIncidentTypeDTO {
  code: string;
  name: string;
  description?: string | null;
  severity: IncidentSeverity;
  parentId?: number | null;
}

export type UpdateIncidentTypeDTO = Partial<CreateIncidentTypeDTO>;

export interface IncidentTypeFilters {
  parentId?: number | null;
  severity?: IncidentSeverity;
  q?: string;
}

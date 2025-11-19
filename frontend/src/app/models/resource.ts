export interface ResourceDTO {
  code: string;
  description: string;
  type: string;
  status: string;
  operationalCapacity: number;
  assignedArea?: string | null;
  setupTimeMinutes?: number | null;
  requiredQualifications: string[];
}

export interface CreateResourceDTO {
  code: string;
  description: string;
  type: string;
  operationalCapacity: number;
  status: string;
  assignedArea?: string | null;
  setupTimeMinutes?: number | null;
  requiredQualifications: string[];
}

export interface UpdateResourceDTO {
  description: string;
  type: string;
  operationalCapacity: number;
  status: string;
  assignedArea?: string | null;
  setupTimeMinutes?: number | null;
  requiredQualifications: string[];
}

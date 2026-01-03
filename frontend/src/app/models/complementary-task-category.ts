export interface ComplementaryTaskCategoryDTO {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  defaultDurationMinutes?: number | null;
  createdAt?: string;
}

export interface ComplementaryTaskCategoryFilters {
  q?: string;
}

export interface CreateComplementaryTaskCategoryDTO {
  code: string;
  name: string;
  description?: string | null;
  defaultDurationMinutes?: number | null;
}

export interface UpdateComplementaryTaskCategoryDTO {
  code?: string;
  name?: string;
  description?: string | null;
  defaultDurationMinutes?: number | null;
}

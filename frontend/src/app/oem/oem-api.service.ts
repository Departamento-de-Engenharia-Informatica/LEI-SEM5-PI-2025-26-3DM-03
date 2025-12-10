import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export interface OperationPlanDto {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  vesselVisitId?: string | null;
  createdAt?: string | null;
}

export interface OperationTaskPreviewDto {
  type: string;
  craneId: string;
  storageAreaId: string;
  startTime: string;
  endTime: string;
}

export interface OperationPlanPreviewDto {
  vvnId: string;
  vesselName: string;
  dockId: string;
  plannedStartTime: string;
  plannedEndTime: string;
  expectedDelayMinutes: number | null;
  algorithmUsed: string;
  operations: OperationTaskPreviewDto[];
}

@Injectable({ providedIn: 'root' })
export class OemApiService {
  constructor(private readonly http: HttpClient) {}

  getOperationPlans() {
    return this.http.get<OperationPlanDto[]>(`/api/oem/operation-plans`, { withCredentials: true });
  }

  previewOperationPlans(date: string, algorithm = 'fake-sequential') {
    return this.http.post<OperationPlanPreviewDto[]>(
      `/api/oem/operation-plans/preview`,
      { date, algorithm },
      { withCredentials: true },
    );
  }

  generateOperationPlans(date: string, algorithm = 'fake-sequential') {
    return this.http.post<OperationPlanDto[]>(
      `/api/oem/operation-plans/generate`,
      { date, algorithm },
      { withCredentials: true },
    );
  }
}

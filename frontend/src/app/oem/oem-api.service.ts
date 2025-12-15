import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

export interface OperationPlanDto {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  vesselVisitId?: string | null;
  sourceVvnId?: string | null;
  dockId?: string | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  targetDay?: string | null;
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

  getOperationPlans(filters?: { from?: string; to?: string; vesselVisitId?: string }) {
    let params = new HttpParams();
    if (filters?.from) {
      params = params.set('from', filters.from);
    }
    if (filters?.to) {
      params = params.set('to', filters.to);
    }
    if (filters?.vesselVisitId) {
      params = params.set('vesselVisitId', filters.vesselVisitId);
    }

    return this.http.get<OperationPlanDto[]>(`/api/oem/operation-plans`, {
      withCredentials: true,
      params: params.keys().length ? params : undefined,
    });
  }

  previewOperationPlans(date: string, algorithm = 'single-crane', vvnIds?: string[]) {
    return this.http.post<OperationPlanPreviewDto[]>(
      `/api/oem/operation-plans/preview`,
      vvnIds && vvnIds.length > 0 ? { date, algorithm, vvnIds } : { date, algorithm },
      { withCredentials: true },
    );
  }

  generateOperationPlans(date: string, algorithm = 'single-crane', vvnIds?: string[]) {
    return this.http.post<OperationPlanDto[]>(
      `/api/oem/operation-plans/generate`,
      vvnIds && vvnIds.length > 0 ? { date, algorithm, vvnIds } : { date, algorithm },
      { withCredentials: true },
    );
  }
}

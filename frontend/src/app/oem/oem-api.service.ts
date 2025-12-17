import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';

export interface OperationPlanDto {
  id: number;
  name: string;
  description?: string | null;
  status: string;
  vesselVisitId?: number | null;
  sourceVvnId?: number | null;
  dockId?: string | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  targetDay?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  algorithmUsed?: string | null;
  createdBy?: string | null;
  lastUpdatedBy?: string | null;
  lastChangeReason?: string | null;
  lastChangeWarnings?: string[] | null;
  tasks?: OperationPlanTaskDto[];
  changeLogs?: OperationPlanChangeLogDto[];
}

export interface OperationTaskPreviewDto {
  type: string;
  craneId: string;
  storageAreaId: string;
  startTime: string;
  endTime: string;
}

export interface OperationPlanPreviewDto {
  vvnId: number;
  vesselName: string;
  dockId: string;
  plannedStartTime: string;
  plannedEndTime: string;
  expectedDelayMinutes: number | null;
  algorithmUsed: string;
  operations: OperationTaskPreviewDto[];
}

export interface OperationPlanTaskDto {
  id?: number;
  type: string;
  craneId?: string | null;
  storageAreaId?: string | null;
  staffIds?: string[];
  startTime: string;
  endTime: string;
}

export interface OperationPlanChangeLogDto {
  id: string;
  operationPlanId: string;
  changedBy?: string | null;
  reason?: string | null;
  createdAt: string;
  warnings?: string[] | null;
  changes?: Record<string, unknown>;
}

export interface OperationPlanUpdateResponse {
  plan: OperationPlanDto;
  warnings: string[];
  logEntry?: OperationPlanChangeLogDto;
}

@Injectable({ providedIn: 'root' })
export class OemApiService {
  private readonly proxyBase = '/api/oem/operation-plans';

  constructor(private readonly http: HttpClient) {}

  private buildParams(filters?: { from?: string; to?: string; vesselVisitId?: string }): HttpParams {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.vesselVisitId) params = params.set('vesselVisitId', filters.vesselVisitId);
    return params;
  }

  getOperationPlans(filters?: { from?: string; to?: string; vesselVisitId?: string }) {
    const params = this.buildParams(filters);
    const opts = {
      withCredentials: true,
      params: params.keys().length ? params : undefined,
    };
    return this.http.get<OperationPlanDto[]>(this.proxyBase, opts);
  }

  previewOperationPlans(date: string, algorithm = 'single-crane', vvnIds?: number[]) {
    const payload = vvnIds && vvnIds.length > 0 ? { date, algorithm, vvnIds } : { date, algorithm };
    const url = `${this.proxyBase}/preview`;
    return this.http.post<OperationPlanPreviewDto[]>(url, payload, { withCredentials: true });
  }

  generateOperationPlans(date: string, algorithm = 'single-crane', vvnIds?: number[]) {
    const payload = vvnIds && vvnIds.length > 0 ? { date, algorithm, vvnIds } : { date, algorithm };
    const url = `${this.proxyBase}/generate`;
    return this.http.post<OperationPlanDto[]>(url, payload, { withCredentials: true });
  }

  getOperationPlan(id: number) {
    const url = `${this.proxyBase}/${id}`;
    return this.http.get<OperationPlanDto>(url, { withCredentials: true });
  }

  updateOperationPlan(
    id: number,
    payload: { lastChangeReason: string } & Partial<OperationPlanDto>,
  ) {
    const url = `${this.proxyBase}/${id}`;
    return this.http.patch<OperationPlanUpdateResponse>(url, payload, { withCredentials: true });
  }
}

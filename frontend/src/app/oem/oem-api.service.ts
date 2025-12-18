import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

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

export interface VesselVisitExecutionListItem {
  id: number;
  vesselVisitId: number;
  vesselName: string;
  berthId?: string | null;
  status: string;
  plannedArrivalTime?: string | null;
  actualArrivalTime?: string | null;
  plannedBerthTime?: string | null;
  actualBerthTime?: string | null;
  plannedDepartureTime?: string | null;
  actualDepartureTime?: string | null;
  totalTurnaroundMinutes?: number | null;
  berthOccupancyMinutes?: number | null;
  waitingForBerthMinutes?: number | null;
  arrivalDelayMinutes?: number | null;
  departureDelayMinutes?: number | null;
  operationsDelayMinutes?: number | null;
}

@Injectable({ providedIn: 'root' })
export class OemApiService {
  private readonly operationPlanBase = '/api/oem/operation-plans';
  private readonly vesselVisitExecutionBase = '/api/oem/vessel-visit-executions';

  constructor(private readonly http: HttpClient) {}

  private buildPlanParams(filters?: { from?: string; to?: string; vesselVisitId?: string | number }): HttpParams {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.vesselVisitId !== undefined && filters?.vesselVisitId !== null && `${filters.vesselVisitId}`.trim() !== '') {
      params = params.set('vesselVisitId', String(filters.vesselVisitId));
    }
    return params;
  }

  getOperationPlans(filters?: { from?: string; to?: string; vesselVisitId?: string | number }) {
    const params = this.buildPlanParams(filters);
    const opts = {
      withCredentials: true,
      params: params.keys().length ? params : undefined,
    };
    return this.http.get<OperationPlanDto[]>(this.operationPlanBase, opts);
  }

  previewOperationPlans(date: string, algorithm = 'single-crane', vvnIds?: number[]) {
    const payload = vvnIds && vvnIds.length > 0 ? { date, algorithm, vvnIds } : { date, algorithm };
    const url = `${this.operationPlanBase}/preview`;
    return this.http.post<OperationPlanPreviewDto[]>(url, payload, { withCredentials: true });
  }

  generateOperationPlans(date: string, algorithm = 'single-crane', vvnIds?: number[]) {
    const payload = vvnIds && vvnIds.length > 0 ? { date, algorithm, vvnIds } : { date, algorithm };
    const url = `${this.operationPlanBase}/generate`;
    return this.http.post<OperationPlanDto[]>(url, payload, { withCredentials: true });
  }

  getOperationPlan(id: number) {
    const url = `${this.operationPlanBase}/${id}`;
    return this.http.get<OperationPlanDto>(url, { withCredentials: true });
  }

  updateOperationPlan(
    id: number,
    payload: { lastChangeReason: string } & Partial<OperationPlanDto>,
  ) {
    const url = `${this.operationPlanBase}/${id}`;
    return this.http.patch<OperationPlanUpdateResponse>(url, payload, { withCredentials: true });
  }

  private buildVveParams(filters?: {
    from?: string;
    to?: string;
    vesselVisitId?: number;
    vesselName?: string;
    status?: string;
  }): HttpParams {
    let params = new HttpParams();
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.vesselVisitId !== undefined && filters?.vesselVisitId !== null) {
      params = params.set('vesselVisitId', String(filters.vesselVisitId));
    }
    if (filters?.vesselName) params = params.set('vesselName', filters.vesselName);
    if (filters?.status) params = params.set('status', filters.status);
    return params;
  }

  getVesselVisitExecutions(filters?: {
    from?: string;
    to?: string;
    vesselVisitId?: number;
    vesselName?: string;
    status?: string;
  }): Observable<VesselVisitExecutionListItem[]> {
    const params = this.buildVveParams(filters);
    const opts = {
      withCredentials: true,
      params: params.keys().length ? params : undefined,
    };
    return this.http.get<VesselVisitExecutionListItem[]>(this.vesselVisitExecutionBase, opts);
  }
}

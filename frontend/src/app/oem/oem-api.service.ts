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
  staffIds?: string[];
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

export interface MissingOperationPlanDto {
  id: number;
  vesselName: string;
  dockId: string;
  eta: string;
  etd?: string | null;
  containers: number;
  status: string;
}

export type ResourceAllocationResourceType = 'crane' | 'dock' | 'staff';

export interface ResourceAllocationSummaryDto {
  resourceType: ResourceAllocationResourceType;
  resourceId: string;
  totalAllocatedMinutes: number;
  totalAllocatedHours: number;
  operationCount: number;
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
  actualUnberthTime?: string | null;
  plannedDepartureTime?: string | null;
  actualDepartureTime?: string | null;
  totalTurnaroundMinutes?: number | null;
  berthOccupancyMinutes?: number | null;
  waitingForBerthMinutes?: number | null;
  arrivalDelayMinutes?: number | null;
  departureDelayMinutes?: number | null;
  operationsDelayMinutes?: number | null;
}

export type OperationExecutionStatus = 'PLANNED' | 'STARTED' | 'COMPLETED' | 'DELAYED';

export interface PlannedOperationWithExecution {
  id: number;
  type: string;
  craneId?: string | null;
  storageAreaId?: string | null;
  staffIds?: string[] | null;
  plannedStartTime: string;
  plannedEndTime: string;
  executionStatus: OperationExecutionStatus;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  actualResourcesUsed?: Record<string, unknown> | null;
}

export interface ExecutedOperationDto {
  plannedOperationId: number;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  resourcesUsed?: Record<string, unknown> | null;
  executionStatus: OperationExecutionStatus;
}

export interface UpsertExecutedOperationPayload {
  actualStartTime?: string;
  actualEndTime?: string;
  resourcesUsed?: Record<string, unknown>;
}

const OEM_API_BASE = 'https://localhost:7167/api/oem';

@Injectable({ providedIn: 'root' })
export class OemApiService {
  private readonly operationPlanBase = `${OEM_API_BASE}/operation-plans`;
  private readonly vesselVisitExecutionBase = `${OEM_API_BASE}/vessel-visit-executions`;

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
    payload: { reason: string } & Partial<OperationPlanDto>,
  ) {
    const url = `${this.operationPlanBase}/${id}`;
    return this.http.patch<OperationPlanUpdateResponse>(url, payload, { withCredentials: true });
  }

  deleteOperationPlan(id: number) {
    const url = `${this.operationPlanBase}/${id}`;
    return this.http.delete<OperationPlanDto>(url, { withCredentials: true });
  }

  getMissingOperationPlans(date: string) {
    const params = new HttpParams().set('date', date);
    const url = `${this.operationPlanBase}/missing`;
    return this.http.get<MissingOperationPlanDto[]>(url, {
      withCredentials: true,
      params,
    });
  }

  regenerateMissingOperationPlans(
    date: string,
    algorithm: string,
    confirmOverwrite: boolean,
  ) {
    const url = `${this.operationPlanBase}/regenerate-missing`;
    return this.http.post<OperationPlanDto[]>(
      url,
      { date, algorithm, confirmOverwrite },
      { withCredentials: true },
    );
  }

  getResourceAllocation(filters: {
    from: string;
    to: string;
    resourceType: ResourceAllocationResourceType;
    resourceId?: string;
  }) {
    let params = new HttpParams()
      .set('from', filters.from)
      .set('to', filters.to)
      .set('resourceType', filters.resourceType);
    if (filters.resourceId) {
      params = params.set('resourceId', filters.resourceId);
    }
    const url = `${this.operationPlanBase}/resource-allocation`;
    return this.http.get<ResourceAllocationSummaryDto[]>(url, {
      withCredentials: true,
      params,
    });
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

	createVesselVisitExecution(payload: { vvnId: number; actualArrivalTime: string; }) {
		const url = this.vesselVisitExecutionBase;
		return this.http.post<VesselVisitExecutionListItem>(url, payload, { withCredentials: true });
	}

  completeVesselVisitExecution(id: number, payload: {
    actualUnberthTime: string;
    actualPortDepartureTime: string;
  }): Observable<VesselVisitExecutionListItem> {
    const url = `${this.vesselVisitExecutionBase}/${id}/complete`;
    return this.http.patch<VesselVisitExecutionListItem>(url, payload, { withCredentials: true });
  }

  updateVesselVisitExecution(
    id: number,
    payload: { actualBerthTime?: string; dockId?: string },
  ): Observable<VesselVisitExecutionListItem> {
    const url = `${this.vesselVisitExecutionBase}/${id}`;
    return this.http.patch<VesselVisitExecutionListItem>(url, payload, {
      withCredentials: true,
    });
  }

  getPlannedOperationsForExecution(id: number): Observable<PlannedOperationWithExecution[]> {
    const url = `${this.vesselVisitExecutionBase}/${id}/planned-operations`;
    return this.http.get<PlannedOperationWithExecution[]>(url, { withCredentials: true });
  }

  upsertExecutedOperation(
    executionId: number,
    plannedOperationId: number,
    payload: UpsertExecutedOperationPayload,
  ): Observable<ExecutedOperationDto> {
    const url = `${this.vesselVisitExecutionBase}/${executionId}/executed-operations/${plannedOperationId}`;
    return this.http.put<ExecutedOperationDto>(url, payload, { withCredentials: true });
  }
}

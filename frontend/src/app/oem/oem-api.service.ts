import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CreateIncidentDTO,
  IncidentDTO,
  IncidentScope,
  IncidentSeverity,
  IncidentStatus,
  UpdateIncidentDTO,
} from '../models/incident';
import { API_BASE_URL } from '../config/api.config';

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

export interface OperationPlanWithTasksDto extends OperationPlanDto {
  tasks: OperationPlanTaskDto[];
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
  vesselVisitNotificationId: number | null;
  vesselVisitId?: number | null;
  vesselName: string;
  berthId?: string | null;
  status: string;
  operationPlanId?: number | null;
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

export interface VesselVisitExecutionDetail extends VesselVisitExecutionListItem {
  identifier?: string;
  vvnId?: string | number | null;
  eta?: string | null;
  etd?: string | null;
  actualBerthTime?: string | null;
  actualUnberthTime?: string | null;
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

export interface VesselVisitExecutionAuditEntry {
  id: number;
  vveId: number;
  changedAt: string;
  changedBy: string;
  action: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  note?: string | null;
}

export interface UpsertExecutedOperationPayload {
  actualStartTime?: string;
  actualEndTime?: string;
  resourcesUsed?: Record<string, unknown>;
}

const OEM_API_BASE = `${API_BASE_URL}/api/oem`;

const INCIDENT_ENDPOINTS = (() => {
  const bases = new Set<string>();
  bases.add(OEM_API_BASE);
  if (window.location.hostname === 'localhost') {
    bases.add('http://localhost:3000/api/oem');
  }
  return Array.from(bases).map((base) => `${base}/incidents`);
})();

@Injectable({ providedIn: 'root' })
export class OemApiService {
  private readonly operationPlanBase = `${OEM_API_BASE}/operation-plans`;
  private readonly vesselVisitExecutionBase = `${OEM_API_BASE}/vessel-visit-executions`;
  private readonly incidentEndpoints = INCIDENT_ENDPOINTS;

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

  getOperationPlanWithTasks(id: number) {
    const url = `${this.operationPlanBase}/${id}`;
    const params = new HttpParams().set('includeTasks', 'true');
    return this.http.get<OperationPlanWithTasksDto>(url, {
      withCredentials: true,
      params,
    });
  }

  getPlannedOperationsByPlan(operationPlanId: number): Observable<PlannedOperationWithExecution[]> {
    return this.getOperationPlanWithTasks(operationPlanId).pipe(
      map((plan) =>
        (plan?.tasks ?? []).map((task) => this.mapTaskToPlannedOperation(task)),
      ),
    );
  }

  getPlannedOperationsForExecution(
    executionId: number,
  ): Observable<PlannedOperationWithExecution[]> {
    const url = `${this.vesselVisitExecutionBase}/${executionId}/planned-operations`;
    return this.http.get<PlannedOperationWithExecution[]>(url, {
      withCredentials: true,
    });
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
    return this.http
      .get<VesselVisitExecutionListItem[]>(this.vesselVisitExecutionBase, opts)
      .pipe(
        map((executions) =>
          Array.isArray(executions)
            ? executions.map((execution) => this.mapExecutionListItem(execution))
            : [],
        ),
      );
  }

  private buildIncidentParams(filters?: {
    vesselIdentifier?: string;
    from?: string;
    to?: string;
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    incidentTypeId?: number;
    scope?: IncidentScope;
  }): HttpParams {
    let params = new HttpParams();
    if (filters?.vesselIdentifier) params = params.set('vesselIdentifier', filters.vesselIdentifier);
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);
    if (filters?.severity) params = params.set('severity', filters.severity);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.incidentTypeId !== undefined && filters?.incidentTypeId !== null) {
      params = params.set('incidentTypeId', String(filters.incidentTypeId));
    }
    if (filters?.scope) params = params.set('scope', filters.scope);
    return params;
  }

  getIncidents(filters?: {
    vesselIdentifier?: string;
    from?: string;
    to?: string;
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    incidentTypeId?: number;
    scope?: IncidentScope;
  }): Observable<IncidentDTO[]> {
    const params = this.buildIncidentParams(filters);
    return this.invokeIncidentEndpoint((endpoint) =>
      this.http.get<IncidentDTO[]>(endpoint, {
        withCredentials: true,
        params: params.keys().length ? params : undefined,
      }),
    );
  }

  getIncident(id: number): Observable<IncidentDTO> {
    return this.invokeIncidentEndpoint((endpoint) =>
      this.http.get<IncidentDTO>(`${endpoint}/${id}`, { withCredentials: true }),
    );
  }

  createIncident(payload: CreateIncidentDTO): Observable<IncidentDTO> {
    return this.invokeIncidentEndpoint((endpoint) =>
      this.http.post<IncidentDTO>(endpoint, payload, { withCredentials: true }),
    );
  }

  updateIncident(id: number, payload: UpdateIncidentDTO): Observable<IncidentDTO> {
    return this.invokeIncidentEndpoint((endpoint) =>
      this.http.patch<IncidentDTO>(`${endpoint}/${id}`, payload, { withCredentials: true }),
    );
  }

  deleteIncident(id: number): Observable<void> {
    return this.invokeIncidentEndpoint((endpoint) =>
      this.http.delete<void>(`${endpoint}/${id}`, { withCredentials: true }),
    );
  }

  setIncidentAffectedVves(incidentId: number, vveIds: number[]): Observable<IncidentDTO> {
    return this.invokeIncidentEndpoint((endpoint) =>
      this.http.post<IncidentDTO>(`${endpoint}/${incidentId}/affected-vves`, { vveIds }, {
        withCredentials: true,
      }),
    );
  }

  addIncidentAffectedVve(incidentId: number, vveId: number): Observable<IncidentDTO> {
    return this.invokeIncidentEndpoint((endpoint) =>
      this.http.post<IncidentDTO>(`${endpoint}/${incidentId}/affected-vves/${vveId}`, {}, {
        withCredentials: true,
      }),
    );
  }

  removeIncidentAffectedVve(incidentId: number, vveId: number): Observable<IncidentDTO> {
    return this.invokeIncidentEndpoint((endpoint) =>
      this.http.delete<IncidentDTO>(`${endpoint}/${incidentId}/affected-vves/${vveId}`, {
        withCredentials: true,
      }),
    );
  }

  getVesselVisitExecution(id: number): Observable<VesselVisitExecutionDetail> {
    const url = `${this.vesselVisitExecutionBase}/${id}`;
    return this.http
      .get<VesselVisitExecutionDetail>(url, { withCredentials: true })
      .pipe(map((execution) => this.mapExecutionDetail(execution)));
  }

	createVesselVisitExecution(payload: { vvnId: number; actualArrivalTime: string; }) {
		const url = this.vesselVisitExecutionBase;
    return this.http
      .post<VesselVisitExecutionListItem>(url, payload, { withCredentials: true })
      .pipe(map((execution) => this.mapExecutionListItem(execution)));
	}

  completeVesselVisitExecution(id: number, payload: {
    actualUnberthTime: string;
    actualPortDepartureTime: string;
  }): Observable<VesselVisitExecutionListItem> {
    const url = `${this.vesselVisitExecutionBase}/${id}/complete`;
    return this.http
      .patch<VesselVisitExecutionListItem>(url, payload, { withCredentials: true })
      .pipe(map((execution) => this.mapExecutionListItem(execution)));
  }

  updateVesselVisitExecution(
    id: number,
    payload: { actualBerthTime?: string; dockId?: string },
  ): Observable<VesselVisitExecutionListItem> {
    const url = `${this.vesselVisitExecutionBase}/${id}`;
    return this.http
      .patch<VesselVisitExecutionListItem>(url, payload, {
        withCredentials: true,
      })
      .pipe(map((execution) => this.mapExecutionListItem(execution)));
  }

  linkOperationPlanToVve(
    executionId: number,
    operationPlanId: number,
  ): Observable<VesselVisitExecutionListItem> {
    const url = `${this.vesselVisitExecutionBase}/${executionId}/link-operation-plan`;
    return this.http
      .patch<VesselVisitExecutionListItem>(
        url,
        { operationPlanId },
        { withCredentials: true },
      )
      .pipe(map((execution) => this.mapExecutionListItem(execution)));
  }

  getExecutedOperationsForExecution(id: number): Observable<ExecutedOperationDto[]> {
    const url = `${this.vesselVisitExecutionBase}/${id}/executed-operations`;
    return this.http.get<ExecutedOperationDto[]>(url, { withCredentials: true });
  }

  getVesselVisitExecutionAudit(id: number): Observable<VesselVisitExecutionAuditEntry[]> {
    const url = `${this.vesselVisitExecutionBase}/${id}/audit`;
    return this.http.get<VesselVisitExecutionAuditEntry[]>(url, { withCredentials: true });
  }

  upsertExecutedOperation(
    executionId: number,
    plannedOperationId: number,
    payload: UpsertExecutedOperationPayload,
  ): Observable<ExecutedOperationDto> {
    const url = `${this.vesselVisitExecutionBase}/${executionId}/executed-operations/${plannedOperationId}`;
    return this.http.put<ExecutedOperationDto>(url, payload, { withCredentials: true });
  }

  private invokeIncidentEndpoint<T>(factory: (endpoint: string) => Observable<T>): Observable<T> {
    return from(this.tryIncidentEndpoints(factory));
  }

  private async tryIncidentEndpoints<T>(factory: (endpoint: string) => Observable<T>): Promise<T> {
    let lastError: unknown = null;
    for (const endpoint of this.incidentEndpoints) {
      try {
        return await firstValueFrom(factory(endpoint));
      } catch (err) {
        lastError = err;
        if (!this.shouldRetryIncidentRequest(err)) {
          throw this.normalizeIncidentError(err);
        }
      }
    }
    throw this.normalizeIncidentError(lastError);
  }

  private shouldRetryIncidentRequest(err: unknown): boolean {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0 || err.status === 404 || err.status === 502 || err.status === 503) {
        return true;
      }
      return false;
    }
    if (err instanceof Error) {
      const message = err.message?.toLowerCase?.() ?? '';
      return (
        message.includes('not found') ||
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('timeout')
      );
    }
    return false;
  }

  private normalizeIncidentError(err: unknown): Error {
    if (err instanceof HttpErrorResponse) {
      const detail =
        err.error?.message ||
        err.error?.detail ||
        (typeof err.error === 'string' ? err.error : null) ||
        err.statusText;
      return new Error(detail || 'Falha ao contactar OEM API.');
    }
    if (err instanceof Error) {
      return err;
    }
    return new Error('Falha ao contactar OEM API.');
  }

  private mapTaskToPlannedOperation(task: OperationPlanTaskDto): PlannedOperationWithExecution {
    return {
      id: task.id ?? 0,
      type: task.type,
      craneId: task.craneId ?? null,
      storageAreaId: task.storageAreaId ?? null,
      staffIds: task.staffIds ?? null,
      plannedStartTime: task.startTime,
      plannedEndTime: task.endTime,
      executionStatus: 'PLANNED',
      actualStartTime: null,
      actualEndTime: null,
      actualResourcesUsed: null,
    };
  }
  private mapExecutionListItem(
    raw: VesselVisitExecutionListItem | VesselVisitExecutionDetail | null | undefined,
  ): VesselVisitExecutionListItem {
    if (!raw) {
      return {
        id: 0,
        vesselVisitNotificationId: null,
        vesselVisitId: null,
        vesselName: '',
        status: '',
      };
    }

    const base = raw as VesselVisitExecutionListItem;
    const notificationId = this.normalizeVvn(
      (raw as VesselVisitExecutionDetail)?.vvnId ??
        base.vesselVisitNotificationId ??
        base.vesselVisitId ??
        null,
    );

    return {
      ...base,
      vesselVisitId: base.vesselVisitId ?? notificationId ?? null,
      vesselVisitNotificationId: notificationId,
    };
  }

  private mapExecutionDetail(
    raw: VesselVisitExecutionDetail | VesselVisitExecutionListItem | null | undefined,
  ): VesselVisitExecutionDetail {
    const listItem = this.mapExecutionListItem(raw);

    if (!raw) {
      return {
        ...listItem,
        vvnId: listItem.vesselVisitNotificationId,
        eta: null,
        etd: null,
        actualBerthTime: listItem.actualBerthTime ?? null,
        actualUnberthTime: listItem.actualUnberthTime ?? null,
      } as VesselVisitExecutionDetail;
    }

    const detail = raw as VesselVisitExecutionDetail;
    const normalizedVvn = this.normalizeVvn(
      detail.vvnId ?? listItem.vesselVisitNotificationId,
    );

    return {
      ...listItem,
      vvnId: normalizedVvn ?? detail.vvnId ?? null,
      eta: detail.eta ?? null,
      etd: detail.etd ?? null,
      actualBerthTime: detail.actualBerthTime ?? listItem.actualBerthTime ?? null,
      actualUnberthTime: detail.actualUnberthTime ?? listItem.actualUnberthTime ?? null,
    } as VesselVisitExecutionDetail;
  }

  private normalizeVvn(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }
}

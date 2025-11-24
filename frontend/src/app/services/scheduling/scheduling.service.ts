import { Injectable } from '@angular/core';

// Use Angular proxy to reach Prolog2 (proxy.conf.json maps /api/scheduling -> http://localhost:5003).
const PROLOG2_API = '/api/scheduling';

export interface VesselContextPayload {
  id: string;
  arrivalHour: number;
  departureHour: number;
  unloadDuration: number;
  loadDuration: number;
}

export interface CraneContextPayload {
  id: string;
  availableFrom: string;
  availableTo: string;
  capacity: number;
}

export interface StaffContextPayload {
  id: string;
  skills: string[];
  shiftStart: string;
  shiftEnd: string;
}

export interface DailyScheduleRequestPayload {
  date: string;
  strategy?: string;
  vessels?: VesselContextPayload[];
  cranes?: CraneContextPayload[];
  staff?: StaffContextPayload[];
}

export interface ScheduledOperationDto {
  vesselId: string;
  dockId?: string | null;
  storageId?: string | null;
  craneIds: string[];
  staffIds: string[];
  startTime: string;
  endTime: string;
  delayMinutes: number;
  multiCrane: boolean;
}

export interface ScheduleSummaryMetrics {
  algorithm: string;
  totalDelayMinutes: number;
  craneHoursUsed: number;
  computationMilliseconds: number;
}

export interface ScheduleComparisonDto {
  selected: ScheduleSummaryMetrics;
  baseline: ScheduleSummaryMetrics;
  delayDeltaMinutes: number;
  computationDeltaMilliseconds: number;
}

export interface DailyScheduleResponse {
  date: string;
  algorithm: string;
  strategy?: string | null;
  multi_crane_intensity?: number;
  computationTimeMs?: number;
  computationMilliseconds: number;
  totalDelayMinutes: number;
  craneHoursUsed: number;
  schedule: ScheduledOperationDto[];
  warnings: string[];
  summary: ScheduleSummaryMetrics;
  comparison?: ScheduleComparisonDto | null;
}

@Injectable({ providedIn: 'root' })
export class SchedulingService {
  private readonly endpoint = `${PROLOG2_API}/daily`;

  private async handleError(response: Response): Promise<never> {
    const body = await response.text();
    try {
      const parsed = body ? JSON.parse(body) : null;
      const detail =
        typeof parsed === 'string'
          ? parsed
          : parsed?.detail ?? parsed?.title ?? parsed?.message;
      throw new Error(detail || response.statusText || `Request failed: ${response.status}`);
    } catch {
      throw new Error(body || response.statusText || `Request failed: ${response.status}`);
    }
  }

  async generateDailySchedule(
    request: DailyScheduleRequestPayload,
    algorithm?: string
  ): Promise<DailyScheduleResponse> {
    // Prolog2 expects only date + algorithm; extra fields are ignored gracefully.
    const body = {
      date: request.date,
      algorithm: algorithm || request.strategy || 'optimal'
    };
    const response = await fetch(`${this.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    const raw = (await response.json()) as any;

    const normalizeSchedule = (ops: any[]): ScheduledOperationDto[] =>
      (ops || []).map((op: any) => {
        const craneIds = Array.isArray(op.assigned_cranes)
          ? op.assigned_cranes
          : op.assigned_crane
          ? [op.assigned_crane]
          : Array.isArray(op.craneIds)
          ? op.craneIds
          : op.crane
          ? [op.crane]
          : [];

        const staffIds = op.assigned_staff
          ? [op.assigned_staff]
          : Array.isArray(op.staffIds)
          ? op.staffIds
          : op.staff
          ? [op.staff]
          : [];

        return {
          vesselId: op.vessel_id ?? op.vessel ?? op.id ?? '',
          dockId: op.assigned_dock ?? op.dock ?? null,
          storageId: op.assigned_storage ?? op.storageLocation ?? op.storageArea ?? null,
          craneIds,
          staffIds,
          startTime: op.start_time ?? op.startHour ?? '',
          endTime: op.end_time ?? op.endHour ?? '',
          delayMinutes: (op.delay_hours ?? op.delayHours ?? 0) * 60,
          multiCrane: (Array.isArray(craneIds) && craneIds.length > 1) || op.multi_crane === true
        };
      });

    const totalDelayMinutes = (() => {
      if (typeof raw.total_delay === 'number') return raw.total_delay * 60;
      if (typeof raw.totalDelayMinutes === 'number') return raw.totalDelayMinutes;
      if (typeof raw.totalDelayHours === 'number') return raw.totalDelayHours * 60;
      return 0;
    })();

    const normalizedSchedule = normalizeSchedule(raw.schedule ?? []);

    const payload: DailyScheduleResponse = {
      date: raw.date,
      algorithm: raw.algorithm ?? raw.strategy ?? 'prolog2',
      strategy: raw.strategy ?? null,
      computationTimeMs: raw.computation_time_ms ?? raw.computationTimeMs ?? raw.computationMilliseconds ?? 0,
      computationMilliseconds: raw.computation_time_ms ?? raw.computationTimeMs ?? raw.computationMilliseconds ?? 0,
      totalDelayMinutes,
      craneHoursUsed: raw.crane_hours_multi ?? raw.crane_hours_single ?? raw.craneHoursUsed ?? 0,
      schedule: normalizedSchedule,
      warnings: raw.warnings ?? [],
      summary: {
        algorithm: raw.algorithm ?? raw.strategy ?? '',
        totalDelayMinutes,
        craneHoursUsed: raw.crane_hours_multi ?? raw.crane_hours_single ?? raw.craneHoursUsed ?? 0,
        computationMilliseconds: raw.computation_time_ms ?? raw.computationTimeMs ?? raw.computationMilliseconds ?? 0
      },
      comparison: null,
      multi_crane_intensity: raw.crane_hours_multi
    };

    return payload;
  }
}

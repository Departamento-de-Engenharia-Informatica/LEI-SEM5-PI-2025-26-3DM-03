import { Injectable } from '@angular/core';

const API_ROOT = 'https://localhost:7167/api';

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
  vessels: VesselContextPayload[];
  cranes: CraneContextPayload[];
  staff: StaffContextPayload[];
}

export interface ScheduledOperationDto {
  vesselId: string;
  dockId?: string | null;
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
  private readonly endpoint = `${API_ROOT}/Scheduling/daily`;

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
    const query = algorithm ? `?algorithm=${encodeURIComponent(algorithm)}` : '';
    const response = await fetch(`${this.endpoint}${query}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    const payload = (await response.json()) as DailyScheduleResponse;
    payload.warnings ??= [];
    payload.schedule ??= [];
    payload.computationMilliseconds ??= payload.computationTimeMs ?? 0;
    payload.summary ??= {
      algorithm: payload.algorithm || payload.strategy || '',
      totalDelayMinutes: payload.totalDelayMinutes,
      craneHoursUsed: payload.craneHoursUsed,
      computationMilliseconds: payload.computationMilliseconds
    };
    return payload;
  }
}

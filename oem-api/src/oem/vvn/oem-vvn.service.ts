import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { Between, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';
import { OemVvn } from './oem-vvn.entity';

@Injectable()
export class OemVvnService {
  private readonly logger = new Logger(OemVvnService.name);
  private readonly todoApiBaseUrl = (
    process.env.TODO_API_BASE_URL ||
    process.env.VESSEL_VISIT_NOTIFICATIONS_URL ||
    'https://localhost:7167/api'
  ).replace(/\/+$/, '');

  constructor(
    @InjectRepository(OemVvn)
    private readonly repo: Repository<OemVvn>,
    private readonly http: HttpService,
  ) {}

  async getApprovedForDay(date: string): Promise<OemVvn[]> {
    const trimmed = date?.trim();
    if (!trimmed) {
      throw new BadRequestException('Date parameter is required in YYYY-MM-DD format.');
    }

    const start = this.parseDayStart(trimmed);
    const end = this.parseDayEnd(trimmed);

    // 1. Try to fetch Approved VVNs from the main TodoApi service
    // Try configured URL, then HTTPS 7167 (Kestrel default), then HTTP 8080 (Kestrel http), then 5000.
    const candidates = [
      this.todoApiBaseUrl,
      'https://localhost:7167/api',
      'http://localhost:8080/api',
      'http://localhost:5000/api',
    ].filter((v, idx, arr) => arr.indexOf(v) === idx); // unique

    for (const base of candidates) {
      const vvnList = await this.tryFetchFromTodoApi(base, start, end);
      if (vvnList.length > 0) {
        return vvnList;
      }
    }

    // 2. Fallback to OEM-local VVNs, if any
    const existing = await this.repo.find({
      where: {
        status: 'APPROVED',
        eta: Between(start, end),
      },
      order: { eta: 'ASC' },
    });

    if (existing.length > 0) {
      return existing;
    }

    // 3. Final fallback: hardcoded demo VVNs for academic purposes
    return this.buildDevSeedForDay(trimmed);
  }

  private mapTodoVvnToOem(dto: VesselVisitNotificationDto): OemVvn {
    const vvn = new OemVvn();
    vvn.id = dto.id.toString();
    vvn.vesselName = dto.vesselId;
    // Use ApprovedDockId if available; otherwise, group under a generic dock
    vvn.dockId = dto.approvedDockId != null ? String(dto.approvedDockId) : 'UNASSIGNED';
    vvn.eta = new Date(dto.arrivalDate);
    vvn.etd = dto.departureDate ? new Date(dto.departureDate) : undefined;
    vvn.containers = dto.cargoManifest?.length ?? 0;
    vvn.status = dto.status?.toUpperCase() || 'APPROVED';
    return vvn;
  }

  private buildDevSeedForDay(date: string): OemVvn[] {
    const mk = (
      id: string,
      vesselName: string,
      dockId: string,
      etaTime: string,
      etdTime: string,
      containers: number,
    ): OemVvn => {
      const vvn = new OemVvn();
      vvn.id = id;
      vvn.vesselName = vesselName;
      vvn.dockId = dockId;
      vvn.eta = new Date(`${date}T${etaTime}Z`);
      vvn.etd = new Date(`${date}T${etdTime}Z`);
      vvn.containers = containers;
      vvn.status = 'APPROVED';
      return vvn;
    };

    if (date === '2025-12-15') {
      return [
        mk('11111111-1111-1111-1111-111111111111', 'Ever Demo', 'A', '08:00:00', '16:00:00', 120),
        mk('22222222-2222-2222-2222-222222222222', 'MSC Example', 'B', '09:30:00', '14:00:00', 80),
        mk('33333333-3333-3333-3333-333333333333', 'Hapag Mock', 'A', '13:00:00', '20:00:00', 150),
      ];
    }

    if (date === '2025-12-16') {
      return [
        mk('44444444-4444-4444-4444-444444444444', 'CMA Sample', 'C', '06:30:00', '17:15:00', 95),
      ];
    }

    // Generic demo seed for any other day: a single vessel at dock A.
    return [mk('demo-vvn-1', 'Demo Vessel', 'A', '08:00:00', '18:00:00', 100)];
  }

  private parseDayStart(date: string): Date {
    const candidate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(candidate.getTime())) {
      throw new BadRequestException(`Invalid date supplied: ${date}. Expected YYYY-MM-DD.`);
    }
    return candidate;
  }

  private parseDayEnd(date: string): Date {
    const candidate = new Date(`${date}T23:59:59.999Z`);
    if (Number.isNaN(candidate.getTime())) {
      throw new BadRequestException(`Invalid date supplied: ${date}. Expected YYYY-MM-DD.`);
    }
    return candidate;
  }

  private async tryFetchFromTodoApi(base: string, dayStart: Date, dayEnd: Date): Promise<OemVvn[]> {
    const url = `${base.replace(/\/+$/, '')}/VesselVisitNotifications`;
    try {
      const response = await firstValueFrom(
        this.http.get<VesselVisitNotificationDto[]>(url, {
          params: { Status: 'Approved' },
          httpsAgent: url.startsWith('https://')
            ? new https.Agent({ rejectUnauthorized: false })
            : undefined,
          timeout: 2_000,
        }),
      );

      const allApproved = response.data ?? [];
      const fromTime = dayStart.getTime();
      const toTime = dayEnd.getTime();

      const forDay = allApproved.filter((v) => {
        const arrival = new Date(v.arrivalDate);
        if (Number.isNaN(arrival.getTime())) {
          return false;
        }
        const t = arrival.getTime();
        return t >= fromTime && t <= toTime;
      });

      if (forDay.length > 0) {
        this.logger.log(`Fetched ${forDay.length} VVNs from ${url}`);
        return forDay.map((v) => this.mapTodoVvnToOem(v));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to fetch VVNs from ${url}: ${msg}`);
    }

    return [];
  }
}

interface VesselVisitNotificationDto {
  id: number;
  vesselId: string;
  agentId: number;
  arrivalDate: string;
  departureDate?: string | null;
  status: string;
  approvedDockId?: number | null;
  cargoManifest?: string[] | null;
}

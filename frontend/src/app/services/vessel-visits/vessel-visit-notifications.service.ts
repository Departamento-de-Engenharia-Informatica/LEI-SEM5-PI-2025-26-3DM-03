import { Injectable } from '@angular/core';
import { CreateVesselVisitNotificationDTO, VesselVisitNotificationDTO } from '../../models/vessel-visit-notification';

// Use dev proxy first (when running `ng serve` with proxy.conf.json), then fallback to direct backend
const baseUrl = '/api';

@Injectable({ providedIn: 'root' })
export class VesselVisitNotificationsService {
  private apiUrl = '/VesselVisitNotifications';

  private async throwIfNotOk(res: Response): Promise<void> {
    if (res.ok) return;
    let detail = '';
    try { detail = await res.text(); } catch {}
    const msg = `Request failed ${res.status}${detail ? ': ' + detail : ''}`;
    throw new Error(msg);
  }

  private async requestWithFallback(pathAndQuery: string, options?: RequestInit): Promise<Response> {
    const proxyUrl = baseUrl + pathAndQuery; // e.g. /api/VesselVisitNotifications
    const directUrl = `https://localhost:7167${baseUrl}${pathAndQuery}`; // e.g. https://localhost:7167/api/VesselVisitNotifications

    try {
      const r = await fetch(proxyUrl, options);
      if (r.ok) return r;
      console.warn(`[VVN] proxy returned ${r.status} for ${proxyUrl}, trying direct backend`);
    } catch (e) {
      console.warn('[VVN] proxy fetch failed, trying direct backend', e);
    }

    const r2 = await fetch(directUrl, options);
    return r2;
  }

  async getAll(params?: { status?: string; submittedFrom?: string; submittedTo?: string; vesselId?: string }): Promise<VesselVisitNotificationDTO[]> {
    const p: string[] = [];
    if (params) {
      if (params.status && params.status !== 'all') p.push(`status=${encodeURIComponent(params.status)}`);
      if (params.submittedFrom) p.push(`submittedFrom=${encodeURIComponent(params.submittedFrom)}`);
      if (params.submittedTo) p.push(`submittedTo=${encodeURIComponent(params.submittedTo)}`);
      if (params.vesselId) p.push(`vesselId=${encodeURIComponent(params.vesselId)}`);
    }
    const suffix = p.length ? `?${p.join('&')}` : '';
    const res = await this.requestWithFallback(`${this.apiUrl}${suffix}`, { credentials: 'include' });
    await this.throwIfNotOk(res);
    return await res.json();
  }

  async getById(id: number | string): Promise<VesselVisitNotificationDTO> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, { credentials: 'include' });
    await this.throwIfNotOk(res);
    return await res.json();
  }

  async create(dto: CreateVesselVisitNotificationDTO): Promise<VesselVisitNotificationDTO> {
    const res = await this.requestWithFallback(this.apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async update(id: number, dto: Partial<Omit<CreateVesselVisitNotificationDTO, 'agentId' | 'vesselId'>> & { status?: string }): Promise<void> {
    const body: any = {};
    if (dto.arrivalDate) body.arrivalDate = dto.arrivalDate;
    if (dto.departureDate) body.departureDate = dto.departureDate;
    if (dto.cargoManifest) body.cargoManifest = dto.cargoManifest;
    if ((dto as any).crewMembers) body.crewMembers = (dto as any).crewMembers;
    if (dto.status) body.status = dto.status;

    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    await this.throwIfNotOk(res);
  }

  async submit(id: number): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}/submit`, {
      method: 'POST',
      credentials: 'include'
    });
    await this.throwIfNotOk(res);
  }

  async approve(id: number, dockId: number, officerId: number): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}/approve/${dockId}/${officerId}`, {
      method: 'POST',
      credentials: 'include'
    });
    await this.throwIfNotOk(res);
  }

  async reject(id: number, officerId: number, reason: string): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}/reject/${officerId}/${encodeURIComponent(reason)}`, {
      method: 'POST',
      credentials: 'include'
    });
    await this.throwIfNotOk(res);
  }

  // Optional status update (endpoint may vary depending on backend design)
  async setStatus(id: number | string, status: 'Approved' | 'Rejected' | 'Cancelled'): Promise<void> {
    // Attempt a PATCH to /VesselVisitNotifications/{id}/status with JSON body { status }
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    await this.throwIfNotOk(res);
  }
}

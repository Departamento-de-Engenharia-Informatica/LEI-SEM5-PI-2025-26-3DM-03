import { Injectable } from '@angular/core';
import {
  CreateIncidentDTO,
  IncidentDTO,
  IncidentScope,
  IncidentSeverity,
  IncidentStatus,
  UpdateIncidentDTO,
} from '../../models/incident';

const baseUrl = '/oem';
const directBaseUrl = 'http://localhost:3000/api/oem';

@Injectable({ providedIn: 'root' })
export class IncidentsService {
  private apiUrl = '/incidents';

  private async requestWithFallback(pathAndQuery: string, options?: RequestInit): Promise<Response> {
    const proxyUrl = `${baseUrl}${pathAndQuery}`;
    const directUrl = `${directBaseUrl}${pathAndQuery}`;

    const fetchWithTimeout = async (url: string, opts?: RequestInit, timeoutMs = 2500) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...(opts || {}), signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      const rProxy = await fetchWithTimeout(proxyUrl, options);
      if (rProxy.ok || rProxy.status === 404) return rProxy;
      console.warn(`[Incidents] proxy returned ${rProxy.status}, trying direct`);
    } catch (e) {
      console.warn('[Incidents] proxy fetch failed, trying direct', e);
    }

    try {
      return await fetchWithTimeout(directUrl, options);
    } catch (e) {
      console.error('[Incidents] direct fetch failed', e);
      throw e as any;
    }
  }

  private async throwIfNotOk(res: Response) {
    if (res.ok) return;
    let t = '';
    try { t = await res.text(); } catch {}
    throw new Error(`Request failed ${res.status}${t ? ': ' + t : ''}`);
  }

  async getAll(filters?: {
    vesselIdentifier?: string;
    from?: string;
    to?: string;
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    incidentTypeId?: number;
    scope?: IncidentScope;
  }): Promise<IncidentDTO[]> {
    const params = new URLSearchParams();
    if (filters?.vesselIdentifier) params.set('vesselIdentifier', filters.vesselIdentifier);
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.incidentTypeId) params.set('incidentTypeId', String(filters.incidentTypeId));
    if (filters?.scope) params.set('scope', filters.scope);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await this.requestWithFallback(`${this.apiUrl}${qs}`, { credentials: 'include' });
    await this.throwIfNotOk(res);
    return await res.json();
  }

  async getById(id: number): Promise<IncidentDTO> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, { credentials: 'include' });
    await this.throwIfNotOk(res);
    return await res.json();
  }

  async create(dto: CreateIncidentDTO): Promise<IncidentDTO> {
    const res = await this.requestWithFallback(this.apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    await this.throwIfNotOk(res);
    return await res.json();
  }

  async update(id: number, dto: UpdateIncidentDTO): Promise<IncidentDTO> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    await this.throwIfNotOk(res);
    return await res.json();
  }

  async delete(id: number): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await this.throwIfNotOk(res);
  }

  async setAffectedVves(incidentId: number, vveIds: number[]): Promise<IncidentDTO> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${incidentId}/affected-vves`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vveIds }),
    });
    await this.throwIfNotOk(res);
    return await res.json();
  }

  async addAffectedVve(incidentId: number, vveId: number): Promise<IncidentDTO> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${incidentId}/affected-vves/${vveId}`, {
      method: 'POST',
      credentials: 'include',
    });
    await this.throwIfNotOk(res);
    return await res.json();
  }

  async removeAffectedVve(incidentId: number, vveId: number): Promise<IncidentDTO> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${incidentId}/affected-vves/${vveId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await this.throwIfNotOk(res);
    return await res.json();
  }
}

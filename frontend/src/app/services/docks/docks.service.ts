import { Injectable } from '@angular/core';
import { CreateDockDTO, DockDTO, UpdateDockDTO } from '../../models/dock';

const baseUrl = '/api';

@Injectable({
  providedIn: 'root'
})
export class DocksService {
  private apiUrl = '/Docks';

  // Helper to try proxy first and fallback to direct backend
  private async requestWithFallback(pathAndQuery: string, options?: RequestInit): Promise<Response> {
    const proxyUrl = baseUrl + pathAndQuery; // e.g. /api/Docks/1
    const directUrl = `https://localhost:7167${baseUrl}${pathAndQuery}`; // e.g. https://localhost:7167/api/Docks/1

    try {
      const r = await fetch(proxyUrl, options);
      if (r.ok) return r;
      console.warn(`requestWithFallback: proxy returned ${r.status} for ${proxyUrl}, trying direct backend`);
    } catch (e) {
      console.warn('requestWithFallback: proxy fetch failed, trying direct backend', e);
    }

    // try direct
    return await fetch(directUrl, options);
  }

  async getAll(query?: { name?: string; vesselTypeId?: number; location?: string }): Promise<DockDTO[]> {
    const params: string[] = [];
    if (query) {
      if (query.name) params.push(`name=${encodeURIComponent(query.name)}`);
      if (query.vesselTypeId) params.push(`vesselTypeId=${query.vesselTypeId}`);
      if (query.location) params.push(`location=${encodeURIComponent(query.location)}`);
    }
    const suffix = params.length ? `?${params.join('&')}` : '';

    // Try the dev proxy first (recommended when running `ng serve` with proxy.conf.json).
    const proxyUrl = baseUrl + this.apiUrl + suffix; // e.g. /api/Docks
    // Fallback direct backend URL useful when proxy isn't used or `ng serve` not running.
    const directBackendUrl = `https://localhost:7167${baseUrl}${this.apiUrl}${suffix}`; // https://localhost:7167/api/Docks

    // Try proxy, if network error or non-OK status, try direct backend once.
    try {
      const res = await fetch(proxyUrl, { credentials: 'include' });
      if (res.ok) return await res.json();
      // If proxy responded but with non-OK (404/500), try direct backend as a best-effort
      console.warn(`DocksService.getAll: proxy returned ${res.status}, trying direct backend`);
    } catch (e) {
      console.warn('DocksService.getAll: proxy fetch failed, trying direct backend', e);
    }

    // Attempt direct backend call as fallback
    const res2 = await fetch(directBackendUrl, { credentials: 'include' });
    if (!res2.ok) throw new Error(`Request failed ${res2.status}`);
    return await res2.json();
  }

  async getById(id: number): Promise<DockDTO> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async create(dto: CreateDockDTO): Promise<DockDTO> {
    const res = await this.requestWithFallback(this.apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async update(id: number, dto: UpdateDockDTO): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }

  async delete(id: number): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }
}

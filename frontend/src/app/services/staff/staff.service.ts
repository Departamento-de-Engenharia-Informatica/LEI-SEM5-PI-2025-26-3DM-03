import { Injectable } from '@angular/core';
import { CreateStaffDTO, StaffDTO, UpdateStaffDTO } from '../../models/staff';

const apiBase = '/api';

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly resourcePath = `${apiBase}/staff`;

  private async requestWithFallback(urlPath: string, options?: RequestInit): Promise<Response> {
    const proxyUrl = urlPath.startsWith('/api') ? urlPath : `${apiBase}${urlPath}`;
    const directUrl = `https://localhost:7167${proxyUrl}`;

    const fetchWithTimeout = async (url: string, opts: RequestInit | undefined, timeoutMs = 2500) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const merged = { ...(opts || {}), signal: controller.signal } as RequestInit;
        return await fetch(url, merged);
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      const direct = await fetchWithTimeout(directUrl, options, 2500);
      if (direct.ok || direct.status === 404 || direct.status === 400) return direct;
      console.warn(`StaffService direct request ${direct.status} for ${directUrl}, retrying via proxy`);
    } catch (e: any) {
      console.warn('StaffService direct fetch failed, trying proxy', e?.message ?? e);
    }

    try {
      return await fetchWithTimeout(proxyUrl, options, 2500);
    } catch (e: any) {
      console.error('StaffService proxy fetch failed', e?.message ?? e);
      throw new Error('Both direct and proxy requests failed');
    }
  }

  async getAll(search?: string, filterBy: string = 'all'): Promise<StaffDTO[]> {
    const params = new URLSearchParams();
    if (search && search.trim().length > 0) params.set('search', search.trim());
    if (filterBy && filterBy !== 'all') params.set('filterBy', filterBy);
    const query = params.toString();
    const res = await this.requestWithFallback(`${this.resourcePath}${query ? `?${query}` : ''}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return [];
    return await res.json();
  }

  async getByMecanographic(mecanographic: string): Promise<StaffDTO> {
    const res = await this.requestWithFallback(`${this.resourcePath}/${encodeURIComponent(mecanographic)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (res.status === 404) throw new Error('Not found');
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async create(dto: CreateStaffDTO): Promise<StaffDTO> {
    const res = await this.requestWithFallback(this.resourcePath, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async update(mecanographic: string, dto: UpdateStaffDTO): Promise<void> {
    const res = await this.requestWithFallback(`${this.resourcePath}/${encodeURIComponent(mecanographic)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }

  async deactivate(mecanographic: string): Promise<void> {
    const res = await this.requestWithFallback(`${this.resourcePath}/${encodeURIComponent(mecanographic)}/deactivate`, {
      method: 'PATCH',
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }
}

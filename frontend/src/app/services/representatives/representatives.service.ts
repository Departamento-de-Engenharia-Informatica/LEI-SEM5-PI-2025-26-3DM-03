import { Injectable } from '@angular/core';
import { CreateRepresentativeDTO, RepresentativeDTO, UpdateRepresentativeDTO } from '../../models/representative';

const apiBase = '/api';

@Injectable({ providedIn: 'root' })
export class RepresentativesService {
  private buildBase(taxNumber: number | string) {
    return `${apiBase}/ShippingAgents/${encodeURIComponent(String(taxNumber))}/Representatives`;
  }

  private async requestWithFallback(urlPath: string, options?: RequestInit): Promise<Response> {
    const proxyUrl = `${urlPath}`.startsWith('/api') ? urlPath : `${apiBase}${urlPath}`;
    const directUrl = `https://localhost:7167${proxyUrl}`;

    const fetchWithTimeout = async (url: string, opts: RequestInit | undefined, timeoutMs = 2000) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const merged = { ...(opts || {}), signal: controller.signal } as RequestInit;
        return await fetch(url, merged);
      } finally {
        clearTimeout(timer);
      }
    };

    // Prefer direct backend first to avoid occasional proxy hangs with HTTPS dev certs.
    try {
      const rDirect = await fetchWithTimeout(directUrl, options, 2500);
      if (rDirect.ok || rDirect.status === 404) return rDirect;
      console.warn(`RepresentativesService: direct returned ${rDirect.status} for ${directUrl}, trying proxy`);
    } catch (e: any) {
      console.warn('RepresentativesService: direct fetch failed or timed out, trying proxy', e?.message ?? e);
    }

    try {
      const rProxy = await fetchWithTimeout(proxyUrl, options, 2500);
      return rProxy;
    } catch (e: any) {
      console.error('RepresentativesService: proxy fetch failed', e?.message ?? e);
      throw new Error('Both direct and proxy requests failed');
    }
  }

  async getAll(taxNumber: number | string): Promise<RepresentativeDTO[]> {
    const res = await this.requestWithFallback(this.buildBase(taxNumber), {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return [];
    return await res.json();
  }

  async getById(taxNumber: number | string, id: number): Promise<RepresentativeDTO> {
    const res = await this.requestWithFallback(`${this.buildBase(taxNumber)}/${id}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (res.status === 404) throw new Error('Not found');
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async create(taxNumber: number | string, dto: CreateRepresentativeDTO): Promise<RepresentativeDTO> {
    const res = await this.requestWithFallback(this.buildBase(taxNumber), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async update(taxNumber: number | string, id: number, dto: UpdateRepresentativeDTO): Promise<RepresentativeDTO> {
    const res = await this.requestWithFallback(`${this.buildBase(taxNumber)}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async deactivate(taxNumber: number | string, id: number): Promise<void> {
    const res = await this.requestWithFallback(`${this.buildBase(taxNumber)}/${id}/deactivate`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }

  async delete(taxNumber: number | string, id: number): Promise<void> {
    const res = await this.requestWithFallback(`${this.buildBase(taxNumber)}/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }
}

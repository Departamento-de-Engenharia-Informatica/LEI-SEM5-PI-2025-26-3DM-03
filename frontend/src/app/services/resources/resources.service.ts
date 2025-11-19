import { Injectable } from '@angular/core';
import { ResourceDTO, CreateResourceDTO, UpdateResourceDTO } from '../../models/resource';

const baseUrl = '/api';

@Injectable({ providedIn: 'root' })
export class ResourcesService {
  private apiUrl = '/Resources';

  private async requestWithFallback(pathAndQuery: string, options?: RequestInit): Promise<Response> {
    const proxyUrl = baseUrl + pathAndQuery;
    const directUrl = `https://localhost:7167${baseUrl}${pathAndQuery}`;

    const fetchWithTimeout = async (url: string, opts: RequestInit | undefined, timeoutMs = 1500) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const merged = { ...(opts || {}), signal: controller.signal } as RequestInit;
        return await fetch(url, merged);
      } finally {
        clearTimeout(timer);
      }
    };

    // Try proxy first (short timeout) then direct (slightly longer). Shortening these reduces perceived UI slowness in dev.
    try {
      const rProxy = await fetchWithTimeout(proxyUrl, options, 1200);
      if (rProxy.ok) return rProxy;
      // If proxy returns 404 or other non-ok, log and try direct as fallback.
      console.warn(`ResourcesService: proxy returned ${rProxy.status} for ${proxyUrl}, trying direct`);
    } catch (e: any) {
      console.warn('ResourcesService: proxy fetch failed or timed out, trying direct', e?.message ?? e);
    }

    try {
      const rDirect = await fetchWithTimeout(directUrl, options, 2000);
      if (rDirect.ok) return rDirect;
      console.warn(`ResourcesService: direct returned ${rDirect.status} for ${directUrl}`);
      throw new Error(`Both proxy and direct requests failed (proxy->direct statuses).`);
    } catch (e: any) {
      console.error('ResourcesService: direct fetch failed', e?.message ?? e);
      throw new Error('Both direct and proxy requests failed');
    }
  }

  async getAll(): Promise<ResourceDTO[]> {
    const res = await this.requestWithFallback(this.apiUrl, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return [];
    return await res.json();
  }

  async getByCode(code: string): Promise<ResourceDTO> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${encodeURIComponent(code)}`, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (res.status === 404) throw new Error('Not found');
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async create(dto: CreateResourceDTO): Promise<ResourceDTO> {
    const res = await this.requestWithFallback(this.apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async update(code: string, dto: UpdateResourceDTO): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${encodeURIComponent(code)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }

  async deactivate(code: string): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${encodeURIComponent(code)}/deactivate`, {
      method: 'PUT',
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }

  async activate(code: string): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${encodeURIComponent(code)}/activate`, {
      method: 'PUT',
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }

  async delete(code: string): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${encodeURIComponent(code)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }
}

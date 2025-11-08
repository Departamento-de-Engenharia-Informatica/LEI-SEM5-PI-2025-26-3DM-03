import { Injectable } from '@angular/core';
import { ResourceDTO, CreateResourceDTO, UpdateResourceDTO } from '../../models/resource';

const baseUrl = '/api';

@Injectable({ providedIn: 'root' })
export class ResourcesService {
  private apiUrl = '/Resources';

  private async requestWithFallback(pathAndQuery: string, options?: RequestInit): Promise<Response> {
    const proxyUrl = baseUrl + pathAndQuery;
    const directUrl = `https://localhost:7167${baseUrl}${pathAndQuery}`;

    const fetchWithTimeout = async (url: string, opts: RequestInit | undefined, timeoutMs = 3000) => {
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
      const r = await fetchWithTimeout(proxyUrl, options, 3000);
      if (r.ok) return r;
      console.warn(`ResourcesService: proxy returned ${r.status} for ${proxyUrl}, trying direct backend`);
    } catch (e: any) {
      console.warn('ResourcesService: proxy fetch failed or timed out, trying direct backend', e?.message ?? e);
    }

    try {
      const r2 = await fetchWithTimeout(directUrl, options, 5000);
      return r2;
    } catch (e: any) {
      console.error('ResourcesService: direct backend fetch failed', e?.message ?? e);
      throw new Error('Both proxy and direct backend requests failed');
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
}

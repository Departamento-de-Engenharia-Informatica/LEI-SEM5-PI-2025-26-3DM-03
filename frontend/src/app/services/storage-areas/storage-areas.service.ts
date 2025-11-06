import { Injectable } from '@angular/core';
import { StorageAreaDTO, CreateStorageAreaDTO, UpdateStorageAreaDTO } from '../../models/storage-area';

const baseUrl = '/api';

@Injectable({ providedIn: 'root' })
export class StorageAreasService {
  private apiUrl = '/StorageAreas';

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

    // Try proxy first
    try {
      const r = await fetchWithTimeout(proxyUrl, options, 3000);
      if (r.ok) return r;
      console.warn(`StorageAreasService: proxy returned ${r.status} for ${proxyUrl}, trying direct backend`);
    } catch (e: any) {
      // abort or network error
      console.warn('StorageAreasService: proxy fetch failed or timed out, trying direct backend', e?.message ?? e);
    }

    // Try direct backend (longer timeout)
    try {
      const r2 = await fetchWithTimeout(directUrl, options, 5000);
      return r2;
    } catch (e: any) {
      console.error('StorageAreasService: direct backend fetch failed', e?.message ?? e);
      throw new Error('Both proxy and direct backend requests failed');
    }
  }

  async getAll(): Promise<StorageAreaDTO[]> {
    const res = await this.requestWithFallback(this.apiUrl, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    // ensure JSON
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return [];
    return await res.json();
  }

  async getById(id: number): Promise<StorageAreaDTO> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (res.status === 404) throw new Error('Not found');
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async create(dto: CreateStorageAreaDTO): Promise<StorageAreaDTO> {
    const res = await this.requestWithFallback(this.apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async update(id: number, dto: UpdateStorageAreaDTO): Promise<StorageAreaDTO> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async delete(id: number): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }
}

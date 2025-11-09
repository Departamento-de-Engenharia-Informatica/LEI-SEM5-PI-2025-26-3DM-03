import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CreateDockDTO, DockDTO, UpdateDockDTO } from '../../models/dock';

const baseUrl = '/api';

@Injectable({
  providedIn: 'root'
})
export class DocksService {
  private apiUrl = '/Docks';
  private readonly cacheKey = 'app_docks_v1';
  private _docks$ = new BehaviorSubject<DockDTO[]>([]);
  public docks$ = this._docks$.asObservable();

  constructor() {
    try {
      const raw = sessionStorage.getItem(this.cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { ts: number; data: DockDTO[] } | null;
        if (parsed && Array.isArray(parsed.data)) {
          // use cached immediately
          this._docks$.next(parsed.data);
        }
      }
    } catch (e) {
      // ignore cache failures
    }
  }

  // Helper to try proxy first and fallback to direct backend
  private async requestWithFallback(pathAndQuery: string, options?: RequestInit): Promise<Response> {
    const proxyUrl = baseUrl + pathAndQuery; // e.g. /api/Docks/1
    const directUrl = `https://localhost:7167${baseUrl}${pathAndQuery}`; // e.g. https://localhost:7167/api/Docks/1

    try {
      console.log(`[DocksService] requestWithFallback -> trying proxy ${proxyUrl}`, options?.method || 'GET');
      const r = await fetch(proxyUrl, options);
      console.log(`[DocksService] proxy response ${r.status} for ${proxyUrl}`);
      if (r.ok) return r;
      console.warn(`requestWithFallback: proxy returned ${r.status} for ${proxyUrl}, trying direct backend`);
    } catch (e) {
      console.warn('requestWithFallback: proxy fetch failed, trying direct backend', e);
    }

    // try direct
    console.log(`[DocksService] requestWithFallback -> trying direct ${directUrl}`, options?.method || 'GET');
    const r2 = await fetch(directUrl, options);
    console.log(`[DocksService] direct response ${r2.status} for ${directUrl}`);
    return r2;
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

    // Try proxy first (fast local dev path). If it returns OK parse and update cache/subject.
    try {
      const res = await fetch(proxyUrl, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        try { sessionStorage.setItem(this.cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch {}
        this._docks$.next(data || []);
        return data;
      }
      // If proxy responded but non-OK, warn and fallthrough to direct
      console.warn(`DocksService.getAll: proxy returned ${res.status}, trying direct backend`);
    } catch (e) {
      console.warn('DocksService.getAll: proxy fetch failed, trying direct backend', e);
    }

    // Attempt direct backend call as fallback
    const res2 = await fetch(directBackendUrl, { credentials: 'include' });
    if (!res2.ok) throw new Error(`Request failed ${res2.status}`);
    const data2 = await res2.json();
    try { sessionStorage.setItem(this.cacheKey, JSON.stringify({ ts: Date.now(), data: data2 })); } catch {}
    this._docks$.next(data2 || []);
    return data2;
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
    const created = await res.json();
    // update cache + subject
    try {
      const current = this._docks$.getValue() || [];
      const next = [created, ...current];
      this._docks$.next(next);
      sessionStorage.setItem(this.cacheKey, JSON.stringify({ ts: Date.now(), data: next }));
    } catch {}
    return created;
  }

  async update(id: number, dto: UpdateDockDTO): Promise<void> {
    console.log('[DocksService] update called', id, dto);
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      console.error('[DocksService] update failed', res.status, txt);
      throw new Error(`Request failed ${res.status}${txt ? ': ' + txt : ''}`);
    }
    // fetch updated item and update cache
    try {
      const r = await this.requestWithFallback(`${this.apiUrl}/${id}`, { credentials: 'include' });
      if (r.ok) {
        const updated = await r.json();
        const current = this._docks$.getValue() || [];
        const idx = current.findIndex(x => x.id === updated.id);
        if (idx >= 0) current[idx] = updated;
        else current.unshift(updated);
        this._docks$.next(current);
        sessionStorage.setItem(this.cacheKey, JSON.stringify({ ts: Date.now(), data: current }));
      } else {
        console.warn('[DocksService] failed to fetch updated dock after PUT', r.status);
      }
    } catch (e) {
      console.warn('[DocksService] error fetching updated dock', e);
    }
  }

  async delete(id: number): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    // remove from cache
    try {
      const current = this._docks$.getValue() || [];
      const next = current.filter(x => x.id !== id);
      this._docks$.next(next);
      sessionStorage.setItem(this.cacheKey, JSON.stringify({ ts: Date.now(), data: next }));
    } catch {}
  }
}

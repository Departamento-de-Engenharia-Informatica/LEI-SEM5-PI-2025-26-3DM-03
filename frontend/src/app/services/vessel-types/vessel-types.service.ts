import { Injectable } from '@angular/core';
import { CreateVesselTypeDTO, UpdateVesselTypeDTO, VesselTypeDTO } from '../../models/vessel-type';

const baseUrl = '/api';

@Injectable({ providedIn: 'root' })
export class VesselTypesService {
  private apiUrl = '/VesselTypes';

  private async requestWithFallback(pathAndQuery: string, options?: RequestInit): Promise<Response> {
    const proxyUrl = baseUrl + pathAndQuery; // /api/...
    const directUrl = `https://localhost:7167${baseUrl}${pathAndQuery}`;

    const fetchWithTimeout = async (url: string, opts?: RequestInit, timeoutMs = 2500) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...(opts || {}), signal: controller.signal });
      } finally { clearTimeout(timer); }
    };

    // Prefer direct backend first (more stable with HTTPS in dev)
    try {
      const rDirect = await fetchWithTimeout(directUrl, options);
      if (rDirect.ok || rDirect.status === 404) return rDirect;
      console.warn(`[VesselTypes] direct returned ${rDirect.status}, trying proxy`);
    } catch (e) {
      console.warn('[VesselTypes] direct fetch failed, trying proxy', e);
    }

    try {
      const rProxy = await fetchWithTimeout(proxyUrl, options);
      return rProxy;
    } catch (e) {
      console.error('[VesselTypes] proxy fetch failed', e);
      throw e as any;
    }
  }

  private async throwIfNotOk(res: Response) {
    if (res.ok) return;
    let t = '';
    try { t = await res.text(); } catch {}
    throw new Error(`Request failed ${res.status}${t ? ': ' + t : ''}`);
  }

  async getAll(search?: string): Promise<VesselTypeDTO[]> {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await this.requestWithFallback(`${this.apiUrl}${q}`, { credentials: 'include' });
    await this.throwIfNotOk(res);
    return await res.json();
  }

  async getById(id: number): Promise<VesselTypeDTO> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, { credentials: 'include' });
    await this.throwIfNotOk(res);
    return await res.json();
  }

  async create(dto: CreateVesselTypeDTO): Promise<VesselTypeDTO> {
    const res = await this.requestWithFallback(this.apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    await this.throwIfNotOk(res);
    return await res.json();
  }

  async update(id: number, dto: UpdateVesselTypeDTO): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    await this.throwIfNotOk(res);
  }

  async delete(id: number): Promise<void> {
    const res = await this.requestWithFallback(`${this.apiUrl}/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    await this.throwIfNotOk(res);
  }
}

import { Injectable } from '@angular/core';

const baseUrl = 'https://localhost:7167/api';

@Injectable({ providedIn: 'root' })
export class VesselsService {
  private apiUrl = '/Vessels';

  private async handleError(res: Response): Promise<never> {
    const text = await res.text();
    try {
      const data = text ? JSON.parse(text) : {};
      const message = typeof data === 'string'
        ? data
        : (data?.message ?? data?.title ?? data?.detail);
      throw new Error(message || res.statusText || `Request failed ${res.status}`);
    } catch {
      throw new Error(text || res.statusText || `Request failed ${res.status}`);
    }
  }

  async getAll(query?: string) {
    const url = query
      ? `${baseUrl}${this.apiUrl}?name=${encodeURIComponent(query)}`
      : baseUrl + this.apiUrl;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async getById(id: string) {
    const res = await fetch(`${baseUrl}${this.apiUrl}/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async create(vessel: any) {
    const res = await fetch(baseUrl + this.apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vessel)
    });
    if (!res.ok) await this.handleError(res);
    return await res.json();
  }

  async update(id: string, vessel: any) {
    const res = await fetch(`${baseUrl}${this.apiUrl}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vessel)
    });
    if (!res.ok) await this.handleError(res);
  }

  async delete(id: string) {
    const res = await fetch(`${baseUrl}${this.apiUrl}/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) await this.handleError(res);
  }
}

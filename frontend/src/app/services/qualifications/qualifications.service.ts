import { Injectable } from '@angular/core';
import { Qualification, QualificationPayload } from '../../models/qualification';

const baseUrl = 'https://localhost:7167/api';

@Injectable({ providedIn: 'root' })
export class QualificationsService {
  private apiUrl = '/Qualifications';

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

  async getAll(search?: string): Promise<Qualification[]> {
    const url = search
      ? `${baseUrl}${this.apiUrl}?search=${encodeURIComponent(search)}`
      : baseUrl + this.apiUrl;

    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) await this.handleError(res);
    return await res.json() as Qualification[];
  }

  async getByCode(code: string): Promise<Qualification> {
    const res = await fetch(`${baseUrl}${this.apiUrl}/${encodeURIComponent(code)}`, {
      credentials: 'include'
    });
    if (!res.ok) await this.handleError(res);
    return await res.json() as Qualification;
  }

  async create(payload: QualificationPayload): Promise<Qualification> {
    const res = await fetch(baseUrl + this.apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) await this.handleError(res);
    return await res.json() as Qualification;
  }

  async update(code: string, payload: QualificationPayload) {
    const res = await fetch(`${baseUrl}${this.apiUrl}/${encodeURIComponent(code)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) await this.handleError(res);
  }

  async delete(code: string) {
    const res = await fetch(`${baseUrl}${this.apiUrl}/${encodeURIComponent(code)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) await this.handleError(res);
  }
}

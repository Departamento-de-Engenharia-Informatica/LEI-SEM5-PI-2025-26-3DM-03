import { Injectable } from '@angular/core';
import { CreateDockDTO, DockDTO, UpdateDockDTO } from '../../models/dock';

const baseUrl = '/api';

@Injectable({
  providedIn: 'root'
})
export class DocksService {
  private apiUrl = '/Docks';

  async getAll(query?: { name?: string; vesselTypeId?: number; location?: string }): Promise<DockDTO[]> {
    let url = baseUrl + this.apiUrl;
    const params: string[] = [];
    if (query) {
      if (query.name) params.push(`name=${encodeURIComponent(query.name)}`);
      if (query.vesselTypeId) params.push(`vesselTypeId=${query.vesselTypeId}`);
      if (query.location) params.push(`location=${encodeURIComponent(query.location)}`);
    }
    if (params.length) url += `?${params.join('&')}`;

    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async getById(id: number): Promise<DockDTO> {
    const res = await fetch(baseUrl + `${this.apiUrl}/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async create(dto: CreateDockDTO): Promise<DockDTO> {
    const res = await fetch(baseUrl + this.apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async update(id: number, dto: UpdateDockDTO): Promise<void> {
    const res = await fetch(baseUrl + `${this.apiUrl}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }

  async delete(id: number): Promise<void> {
    const res = await fetch(baseUrl + `${this.apiUrl}/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }
}

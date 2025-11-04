import { Injectable } from '@angular/core';
// Use fetch API to avoid external dependency on axios in the dev environment.
const baseUrl = '/api';

@Injectable({
  providedIn: 'root'
})
export class VesselsService {
  private apiUrl = '/vessels';

  async getAll() {
    const res = await fetch(baseUrl + this.apiUrl, { credentials: 'include' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async getById(id: number) {
    const res = await fetch(baseUrl + `${this.apiUrl}/${id}`, { credentials: 'include' });
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
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async update(id: number, vessel: any) {
    const res = await fetch(baseUrl + `${this.apiUrl}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vessel)
    });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async delete(id: number) {
    const res = await fetch(baseUrl + `${this.apiUrl}/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
  }
}

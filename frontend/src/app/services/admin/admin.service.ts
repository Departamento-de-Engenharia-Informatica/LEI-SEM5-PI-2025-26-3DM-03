import { Injectable } from '@angular/core';

const apiBase = '/admin';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private async requestWithFallback(path: string, options?: RequestInit): Promise<Response> {
    const relative = path.startsWith('/') ? path : `/${path}`;
    const direct = `https://localhost:7167${relative}`;

    const fetchWithTimeout = async (url: string, opts: RequestInit | undefined, timeoutMs = 2500) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const merged = { ...(opts || {}), signal: controller.signal } as RequestInit;
        return await fetch(url, merged);
      } finally { clearTimeout(timer); }
    };

    try {
      const proxied = await fetchWithTimeout(relative, options, 2500);
      if (proxied.ok) return proxied;
    } catch {}

    return await fetchWithTimeout(direct, options, 2500);
  }

  async getUsers(): Promise<any[]> {
    const res = await this.requestWithFallback(`${apiBase}/users`, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async getRoles(): Promise<any[]> {
    const res = await this.requestWithFallback(`${apiBase}/roles`, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async createUser(dto: { email: string; name?: string; roleId?: number; active?: boolean }) {
    const res = await this.requestWithFallback(`${apiBase}/users`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return await res.json();
  }

  async updateUserRole(id: number, roleId: number) {
    return this.updateUserRoles(id, [roleId]);
  }

  async updateUserRoles(id: number, roleIds: number[]) {
    const res = await this.requestWithFallback(`${apiBase}/users/${id}/roles`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleIds }) });
    if (!res.ok) throw new Error(await res.text());
  }

  async setActive(id: number, active: boolean) {
    const res = await this.requestWithFallback(`${apiBase}/users/${id}/activate`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
    if (!res.ok) throw new Error(await res.text());
  }

  async deleteUser(id: number) {
    const res = await this.requestWithFallback(`${apiBase}/users/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(await res.text());
  }

  async sendActivationLink(id: number) {
    const res = await this.requestWithFallback(`${apiBase}/users/${id}/activation-links`, { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

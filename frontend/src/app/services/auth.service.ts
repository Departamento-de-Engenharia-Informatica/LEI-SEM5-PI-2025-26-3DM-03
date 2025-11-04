import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  login() {
    // Redirect to backend login (server handles OIDC)
    window.location.href = '/authtest/login';
  }

  logout() {
    window.location.href = '/authtest/logout';
  }

  async me() {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) {
      const text = await res.text().catch(() => null);
      const err = new Error(`Request failed ${res.status}` + (text ? `: ${text}` : ''));
      // attach status for caller
      (err as any).status = res.status;
      throw err;
    }
    return await res.json();
  }
}

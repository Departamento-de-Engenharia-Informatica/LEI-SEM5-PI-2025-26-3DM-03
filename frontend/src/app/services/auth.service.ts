import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  login() {
    // Debug-friendly redirect to backend login (server handles OIDC).
    // Use absolute URL to avoid proxy issues in dev and make the navigation visible.
    console.log('[AuthService] login() called - redirecting to backend OIDC login');
    try {
      window.location.href = 'https://localhost:7167/authtest/login';
    } catch (e) {
      console.error('[AuthService] redirect failed', e);
      // fallback to relative path
      window.location.href = '/authtest/login';
    }
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

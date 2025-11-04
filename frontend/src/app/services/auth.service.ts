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
    // Ensure we call the backend logout endpoint (absolute URL) so the cookie is removed on the API origin
    try {
      window.location.href = 'https://localhost:7167/authtest/logout';
    } catch {
      window.location.href = '/authtest/logout';
    }
  }

  async me() {
    // Request the backend auth status directly from the API origin so cookies are included
    const apiUrl = 'https://localhost:7167/authtest/me';
    const res = await fetch(apiUrl, { credentials: 'include' });
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

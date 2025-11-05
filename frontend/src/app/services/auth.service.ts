import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

export interface AuthUser {
  name?: string;
  email?: string;
  roles?: string[];
  role?: string; // primary role (compat)
  access_token?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBase = 'https://localhost:7167';

  // BehaviorSubject holding the current user or null
  private _user$ = new BehaviorSubject<AuthUser | null>(null);
  // public observable for components to subscribe
  public readonly user$ = this._user$.asObservable();

  constructor(private http: HttpClient) {
    // load from localStorage if present (optimistic)
    try {
      const stored = localStorage.getItem('auth_user');
      if (stored) this._user$.next(JSON.parse(stored) as AuthUser);
    } catch { /* ignore */ }
  }

  // Check authentication on backend (includes cookies)
  checkAuth(): void {
    this.http.get<AuthUser>(`${this.apiBase}/authtest/me`, { withCredentials: true }).subscribe({
      next: (user) => {
        this._user$.next(user);
        try { localStorage.setItem('auth_user', JSON.stringify(user)); } catch { }
      },
      error: (err) => {
        // 401/403 or network errors clear session
        this._user$.next(null);
        try { localStorage.removeItem('auth_user'); } catch { }
      }
    });
  }

  // Start login by navigating to backend login endpoint (backend handles Google OIDC)
  login(): void {
    window.location.href = `${this.apiBase}/authtest/login`;
  }

  // Logout: call backend to clear cookie and then clear client state
  logout(): void {
    this.http.get(`${this.apiBase}/authtest/logout`, { withCredentials: true }).subscribe({
      next: () => {
        try { localStorage.clear(); } catch { }
        this._user$.next(null);
        window.location.href = '/';
      },
      error: () => {
        try { localStorage.clear(); } catch { }
        this._user$.next(null);
        window.location.href = '/';
      }
    });
  }

  // Utility helpers
  get currentUser(): AuthUser | null { return this._user$.value; }

  isAuthenticated(): boolean { return !!this._user$.value; }

  hasRole(role: string): boolean {
    const u = this._user$.value;
    if (!u) return false;
    if (u.role && u.role.toLowerCase() === role.toLowerCase()) return true;
    if (u.roles && u.roles.some(r => r.toLowerCase() === role.toLowerCase())) return true;
    return false;
  }
}

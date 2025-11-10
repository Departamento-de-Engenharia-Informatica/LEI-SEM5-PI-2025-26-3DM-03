// src/app/core/auth/auth.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthUser } from '../../models/auth-user';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom, timeout } from 'rxjs';
//import { BehaviorSubject, Observable } from 'rxjs';
//import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService  {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly apiBase = 'https://localhost:7167';

  private _user: AuthUser | null = null;
  public authDeniedReason: string | null = null;  
   private _loggedIn = new BehaviorSubject<boolean>(false);
  loggedIn$ = this._loggedIn.asObservable();

  
  constructor(private http: HttpClient, private router: Router){  }
 
  public get user(): AuthUser | null {
    return this._user;
  }

  // Convenience helpers for templates / components
  isAdmin(): boolean { return (this._user?.role === 'admin'); }
  hasRole(r: string): boolean { return !!this._user && (this._user.role === r || (Array.isArray(this._user.roles) && this._user.roles.includes(r))); }
  hasAny(roles: string[]): boolean { return !!this._user && (this.isAdmin() || roles.some(r => this.hasRole(r))); }
 
 loadUserFromLocalStorage(): void {
  console.log('Loading user from localSaaaaaaaaaaaaaaaaaaaaaaaaaatorage...');
  // Load persisted user if present but do NOT perform navigation here.
  // Navigation should be handled by the App component/guard to avoid
  // navigation loops during startup.
  try {
    const data = localStorage.getItem(this.TOKEN_KEY);
    if (data) {
  const user: AuthUser = JSON.parse(data) as AuthUser;
  // Normalize role names coming from backend (e.g. "Admin", "LogisticsOperator")
  this.normalizeUserRoles(user);
  this._user = user ?? null;
  this._loggedIn.next(user !== null ? true : false);
      //this.router.navigate(['/'])
    } else {
      this._user = null;
      this._loggedIn.next(false);
      //this.router.navigate(['/login'])
    }
  } catch (error) {
    console.error('Invalid user data in localStorage', error);
    try { localStorage.removeItem(this.TOKEN_KEY); } catch {}
    this._user = null;
    this._loggedIn.next(false);
  }
}


  /**
   * Check authentication by calling backend /authtest/me.
   * Returns a Promise which resolves when the check is complete.
   * This method sets internal state but does NOT perform navigation.
   */
  async checkAuth(): Promise<void> {
    console.log('check auth ...');
    try {
  const user = await firstValueFrom(this.http.get<AuthUser>(`${this.apiBase}/authtest/me`, { withCredentials: true }).pipe(timeout(5000)));
  console.log('[AuthService] checkAuth result:', user);
  // Normalize roles returned by backend so UI role checks match
  this.normalizeUserRoles(user);
  this._user = user ?? null;
  this._loggedIn.next(user !== null ? true : false);
  try { localStorage.setItem(this.TOKEN_KEY, JSON.stringify(user)); } catch {}
    } catch (err) {
      console.error('[AuthService] Auth check failed', err);
      this._user = null
      this._loggedIn.next(false);
      try { localStorage.removeItem(this.TOKEN_KEY); } catch {}
    }
  }

  /**
   * Map server role names into the frontend's simplified role keys:
   * admin | operator | agent | authority
   */
  private normalizeUserRoles(user: AuthUser | null | undefined) {
    if (!user) return;
    const mapRole = (r?: string | null) => {
      if (!r) return r;
      const s = r.toString();
      const lower = s.toLowerCase();
      if (lower.includes('admin')) return 'admin';
      if (lower.includes('operator') || lower.includes('logistic')) return 'operator';
      if (lower.includes('agent') || lower.includes('representative')) return 'agent';
      if (lower.includes('authority') || lower.includes('port')) return 'authority';
      // fallback: return lower-cased short token
      return lower;
    };

    // normalize primary role
    try { user.role = mapRole(user.role); } catch {}
    // normalize all roles array if present
    try { user.roles = Array.isArray(user.roles) ? (user.roles.map(r => mapRole(r)).filter(x => !!x) as string[]) : user.roles; } catch {}
    // Ensure primary role also appears inside roles array for unified checks
    try {
      if (user.role && (!Array.isArray(user.roles) || !user.roles.includes(user.role))) {
        user.roles = Array.isArray(user.roles) ? [...user.roles, user.role] : [user.role];
      }
    } catch {}
  }

  login(): void {
    // use relative path so proxy.conf.json can forward to backend
    window.location.href = `${this.apiBase}/authtest/login`;
  }

  /** Limpa sessão */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this._user = null;
    this._loggedIn.next(false);
  }
 
  private decodeJwt(token: string): any {
    try {
      const payload = token.split('.')[1];
      const json = decodeURIComponent(
        atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(json);
    } catch {
      return {};
    }
  }

  /** Extrai roles em formatos comuns (.NET, Keycloak, etc.) */
  private extractRoles(payload: any): string[] {
    // diretos
    for (const k of [
      'roles',
      'role',
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role',
    ]) {
      const v = payload?.[k];
      if (v) return Array.isArray(v) ? v : [String(v)];
    }

    // Keycloak realm_access
    const realm = payload?.realm_access?.roles;
    if (Array.isArray(realm)) return realm;

    // Keycloak resource_access: agrega todas
    const resAcc = payload?.resource_access;
    if (resAcc && typeof resAcc === 'object') {
      const all: string[] = [];
      Object.values(resAcc).forEach((o: any) => {
        if (o?.roles && Array.isArray(o.roles)) all.push(...o.roles);
      });
      if (all.length) return all;
    }
    return [];
  }
}

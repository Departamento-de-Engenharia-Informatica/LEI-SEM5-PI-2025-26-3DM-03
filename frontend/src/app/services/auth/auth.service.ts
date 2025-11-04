// src/app/core/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type AppUser = {
  id?: string;
  username?: string;
  roles: string[];
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private _user$ = new BehaviorSubject<AppUser | null>(null);

  constructor() {
    const token = this.getToken();
    if (token) this.applyToken(token);
  }

  /** Observable do utilizador atual (ou null) */
  get user$(): Observable<AppUser | null> {
    return this._user$.asObservable();
  }

  /** Snapshot síncrono do utilizador */
  get snapshot(): AppUser | null {
    return this._user$.value;
  }

  /** True/false se há sessão ativa */
  get isLoggedIn$(): Observable<boolean> {
    return this.user$.pipe(map(u => !!u));
  }

  /** Guarda o token e atualiza o estado */
  login(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.applyToken(token);
  }

  /** Limpa sessão */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this._user$.next(null);
  }

  /** Lê o token atual (ou null) */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /** Verifica se o utilizador tem pelo menos uma das roles dadas */
  hasAnyRole(...roles: string[]): boolean {
    const u = this._user$.value;
    if (!u) return false;
    return roles.some(r => u.roles.includes(r));
  }

  // ---------- Internos ----------
  private applyToken(token: string): void {
    const payload = this.decodeJwt(token);
    const roles = this.extractRoles(payload);
    const user: AppUser = {
      id: payload?.sub || payload?.nameid,
      username: payload?.unique_name || payload?.name || payload?.preferred_username,
      roles,
    };
    this._user$.next(user);
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

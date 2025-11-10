// src/app/core/guards/auth.guard.ts
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../components/toast/toast.service';

const defaultPath = '/';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router, private toast: ToastService) {}

  canActivate(route: ActivatedRouteSnapshot): boolean  {
    const path = route.routeConfig?.path || '';
    const requiredRoles: string[] | undefined = route.data?.['roles'];

    const user = this.auth.user;
    const role = user?.role as string | undefined;
    const loggedIn = !!user;

    // If not logged in and not going to login, redirect to login
    if (!loggedIn && path !== 'login') {
      try { this.toast.info('Inicie sessão para continuar'); } catch {}
      this.router.navigate(['/login']);
      return false;
    }

    // No specific roles configured -> allow
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // Admin has access to everything
    if (role === 'admin') return true;

    // Role must be one of required
    const allowed = !!role && requiredRoles.includes(role);
    if (!allowed) {
      try { this.toast.error('Acesso negado'); } catch {}
      // Send to a safe default; if already logged in, go to first allowed menu or root
      this.router.navigate(['/']);
      return false;
    }
    return true;
  }
}

// src/app/core/guards/auth.guard.ts
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';

const defaultPath = '/';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
 
constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean  {
    return true;
 
/*
    const isLoggedIn = this.auth.loggedIn;
    console.log('[AuthGuard] canActivate path=', route.routeConfig?.path, 'loggedIn=', isLoggedIn);
    const isAuthForm = ['login'].includes(route.routeConfig?.path || '');
    const defaultPath = '/';

    if (isLoggedIn && isAuthForm) { 
        this.router.navigate([defaultPath]);
        return false;
    }

    if (!isLoggedIn && !isAuthForm) { 
      this.router.navigate(['/login']);
      return false;
    }
 
    return isLoggedIn || isAuthForm; */
  }
}

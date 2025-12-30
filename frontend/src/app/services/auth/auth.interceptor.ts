// src/app/core/auth/auth.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { classifyApi } from '../http/api-routing.util';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (classifyApi(req.url) !== 'oem') {
      return next.handle(req);
    }

    const user = this.auth.user;
    if (!user) {
      return next.handle(req);
    }

    const headers: Record<string, string> = {};

    const roles = Array.isArray(user.roles) ? [...user.roles] : [];
    if (user.role && !roles.includes(user.role)) {
      roles.push(user.role);
    }
    if (!req.headers.has('x-app-roles') && roles.length) {
      headers['x-app-roles'] = roles.join(',');
    }

    if (!req.headers.has('x-app-email') && user.email) {
      headers['x-app-email'] = user.email;
    }

    if (!req.headers.has('x-app-name') && user.name) {
      headers['x-app-name'] = user.name;
    }

    if (Object.keys(headers).length === 0) {
      return next.handle(req);
    }

    return next.handle(req.clone({ setHeaders: headers }));
  }
}

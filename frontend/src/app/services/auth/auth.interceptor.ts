// src/app/core/auth/auth.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const user = this.auth.user;
    if (!user) return next.handle(req);
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${user}` },
    });
    return next.handle(cloned);
  }
}

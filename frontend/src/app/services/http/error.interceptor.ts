import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { classifyApi } from './api-routing.util';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const apiKind = classifyApi(req.url);

    return next.handle(req).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          // Apenas erros de autenticacao da TodoAPI provocam logout global
          if (apiKind === 'todo' && (error.status === 401 || error.status === 403)) {
            try {
              this.auth.logout();
            } catch (e) {
              console.error('Failed to logout after auth error', e);
            }
            try {
              this.router.navigate(['/login']);
            } catch (e) {
              console.error('Failed to navigate to login after auth error', e);
            }
          } else {
            // Para OEM / Scheduling ou outros: loga mas nao mexe no estado global de auth
            console.error('HTTP error from API', {
              api: apiKind,
              status: error.status,
              url: req.url,
              message: error.message,
            });
          }
        }

        return throwError(() => error);
      }),
    );
  }
}

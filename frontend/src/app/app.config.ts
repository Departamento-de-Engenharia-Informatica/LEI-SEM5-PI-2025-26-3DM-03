import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  APP_INITIALIZER,
} from '@angular/core';
import { AuthService } from './services/auth/auth.service';
import { provideRouter } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay
} from '@angular/platform-browser';
import {
  provideHttpClient,
  withInterceptorsFromDi
} from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),

    // ✅ adiciona suporte HTTP global (resolve o erro "No provider for HttpClient")
    provideHttpClient(withInterceptorsFromDi()),

    // ✅ mantém o suporte a hydration (resolve aviso NG0505)
    provideClientHydration(withEventReplay()),
    // Ensure the app loads user from localStorage before Angular runs lifecycle hooks.
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthService) => () => auth.loadUserFromLocalStorage(),
      deps: [AuthService],
      multi: true,
    },
  ],
};

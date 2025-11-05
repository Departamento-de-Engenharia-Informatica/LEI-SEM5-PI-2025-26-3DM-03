import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
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
  ],
};

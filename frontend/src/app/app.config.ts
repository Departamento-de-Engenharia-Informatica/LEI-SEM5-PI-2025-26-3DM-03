import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  APP_INITIALIZER,
  importProvidersFrom,
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
import { TranslateLoader, TranslateModule, TranslateService, TranslateCompiler } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { TranslateMessageFormatCompiler } from '@ngx-translate/messageformat-compiler';

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, '/assets/i18n/', '.json');
}

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

    // i18n: ngx-translate with HTTP loader and MessageFormat compiler
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: { provide: TranslateLoader, useFactory: HttpLoaderFactory, deps: [HttpClient] },
        compiler: { provide: TranslateCompiler, useClass: TranslateMessageFormatCompiler },
        defaultLanguage: (localStorage.getItem('app_lang') as any) || 'pt'
      })
    ),
  ],
};

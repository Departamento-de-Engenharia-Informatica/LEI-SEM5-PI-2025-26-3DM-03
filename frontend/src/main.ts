import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

function installChunkLoadErrorReload(): void {
  if (typeof window === 'undefined') return;

  const reloadKey = 'app_chunk_reload_attempted';
  const shouldReload = (err: unknown): boolean => {
    const message = (err as { message?: string })?.message ?? '';
    return typeof message === 'string' && (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('ChunkLoadError')
    );
  };

  const handleError = (err: unknown) => {
    if (!shouldReload(err)) return;
    try {
      if (sessionStorage.getItem(reloadKey) === '1') {
        return;
      }
      sessionStorage.setItem(reloadKey, '1');
    } catch {}
    window.location.reload();
  };

  window.addEventListener('error', (event) => handleError((event as ErrorEvent)?.error));
  window.addEventListener('unhandledrejection', (event) => handleError((event as PromiseRejectionEvent)?.reason));
  window.addEventListener('load', () => {
    try { sessionStorage.removeItem(reloadKey); } catch {}
  });
}

installChunkLoadErrorReload();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

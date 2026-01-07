import { Injectable } from '@angular/core';

export type ApiKind = 'todo' | 'oem' | 'scheduling' | 'other';

/**
 * Classifica a request com base no path, para saber a que API pertence.
 * Usa apenas o pathname para funcionar tanto com URLs relativas (/api/...) como absolutas (https://<host>/authtest/...).
 */
export function classifyApi(url: string): ApiKind {
  try {
    const parsed = new URL(url, window.location.origin);
    const path = parsed.pathname || '';

    if (path.startsWith('/api/oem')) return 'oem';
    if (path.startsWith('/api/scheduling')) return 'scheduling';
    if (path.startsWith('/api') || path.startsWith('/authtest')) return 'todo';

    return 'other';
  } catch {
    // Fallback defensivo se URL for invalida
    if (url.startsWith('/api/oem')) return 'oem';
    if (url.startsWith('/api/scheduling')) return 'scheduling';
    if (url.startsWith('/api') || url.startsWith('/authtest')) return 'todo';
    return 'other';
  }
}

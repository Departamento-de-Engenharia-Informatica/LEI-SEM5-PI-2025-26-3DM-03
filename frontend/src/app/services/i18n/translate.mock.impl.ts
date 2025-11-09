import { Injectable } from '@angular/core';

type Translations = { [key: string]: string };

@Injectable({ providedIn: 'root' })
export class MockTranslateService {
  private current = 'pt';
  private cache: Record<string, Translations> = {};

  addLangs(list: string[]) { /* noop for compatibility */ }
  setDefaultLang(l: string) { this.current = l; }

  get currentLang() { return this.current; }

  async use(lang: string) {
    this.current = lang;
    if (!this.cache[lang]) {
      try {
        const resp = await fetch(`/assets/i18n/${lang}.json`);
        if (resp.ok) {
          this.cache[lang] = await resp.json();
        } else {
          this.cache[lang] = {};
        }
      } catch (e) {
        this.cache[lang] = {};
      }
    }
    return this.cache[lang];
  }

  instant(key: string): string {
    const t = this.cache[this.current] || {};
    // support nested keys like 'menu.dashboard'
    const parts = key.split('.');
    let v: any = t;
    for (const p of parts) {
      if (v && typeof v === 'object' && p in v) v = v[p];
      else { v = undefined; break; }
    }
    return (typeof v === 'string' ? v : key);
  }
}

export function createMockTranslateService() { return new MockTranslateService();
}

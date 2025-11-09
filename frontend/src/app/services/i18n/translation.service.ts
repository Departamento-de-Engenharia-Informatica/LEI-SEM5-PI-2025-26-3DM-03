import { Injectable } from '@angular/core';
import { MockTranslateService } from './translate.mock.impl';

export type Lang = 'en' | 'pt';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  constructor(private translate: MockTranslateService) {
    const saved = (localStorage.getItem('app_lang') as Lang) || 'pt';
    this.translate.addLangs(['en','pt']);
    this.translate.setDefaultLang(saved);
    // start loading saved language (fire-and-forget is fine)
    void this.translate.use(saved);
  }

  setLang(l: Lang) {
    localStorage.setItem('app_lang', l);
    void this.translate.use(l);
  }

  getLang(): Lang { return (this.translate.currentLang as Lang) || 'pt'; }

  t(key: string): string { return this.translate.instant(key); }
}

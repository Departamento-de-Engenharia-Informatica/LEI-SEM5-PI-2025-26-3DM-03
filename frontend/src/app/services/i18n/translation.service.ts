import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type Lang = 'en' | 'pt';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  constructor(private translate: TranslateService) {
    const saved = (localStorage.getItem('app_lang') as Lang) || 'pt';
    this.translate.addLangs(['en','pt']);
    this.translate.setDefaultLang(saved);
    this.translate.use(saved);
  }

  setLang(l: Lang) {
    localStorage.setItem('app_lang', l);
    this.translate.use(l);
  }

  getLang(): Lang { return (this.translate.currentLang as Lang) || 'pt'; }

  t(key: string): string { return this.translate.instant(key); }
}

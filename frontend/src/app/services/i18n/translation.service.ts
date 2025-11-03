import { Injectable } from '@angular/core';

export type Lang = 'en' | 'pt';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private lang: Lang = (localStorage.getItem('app_lang') as Lang) || 'en';

  private translations: Record<Lang, Record<string, string>> = {
    en: {
      'title': 'Port Operations Management',
      'menu.dashboard': 'Dashboard',
      'menu.vessels': 'Vessels',
      'menu.docks': 'Docks',
      'menu.resources': 'Resources',
      'menu.representatives': 'Representatives',
      'menu.settings': 'Settings',
      'nav.help': 'Help',
      'home': 'Home',
      'breadcrumb.dashboard': 'Dashboard',
      'logout': 'Logout'
    },
    pt: {
      'title': 'Gestão de Operações Portuárias',
      'menu.dashboard': 'Painel',
      'menu.vessels': 'Navios',
      'menu.docks': 'Docas',
      'menu.resources': 'Recursos',
      'menu.representatives': 'Representantes',
      'menu.settings': 'Configurações',
      'nav.help': 'Ajuda',
      'home': 'Início',
      'breadcrumb.dashboard': 'Painel',
      'logout': 'Sair'
    }
  };

  setLang(l: Lang) {
    this.lang = l;
    localStorage.setItem('app_lang', l);
  }

  getLang(): Lang { return this.lang; }

  t(key: string): string {
    return this.translations[this.lang][key] ?? key;
  }
}

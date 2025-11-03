import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslationService } from '../../services/i18n/translation.service';

type Role = 'admin' | 'operator' | 'agent' | 'authority';

interface MenuItem {
  key: string;
  label_en: string;
  label_pt: string;
  icon?: string; // css class or inline svg name
  route: string;
  roles: Role[];
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent {
  // Mocked user role for demo; replace with real auth integration
  userRole: Role = 'admin';

  // Language comes from the translation service
  get lang() { return this.i18n.getLang(); }

  // Application title via translation service
  get title() { return this.i18n.t('title'); }

  // Define menu items with roles
  menuItems: MenuItem[] = [
    { key: 'dashboard', label_en: 'Dashboard', label_pt: 'Painel', icon: 'bi-speedometer2', route: '/dashboard', roles: ['admin','operator','agent','authority'] },
    { key: 'vessels', label_en: 'Vessels', label_pt: 'Navios', icon: 'bi-ship', route: '/vessels', roles: ['admin','operator'] },
    { key: 'docks', label_en: 'Docks', label_pt: 'Docas', icon: 'bi-box-seam', route: '/docks', roles: ['admin','authority'] },
    { key: 'resources', label_en: 'Resources', label_pt: 'Recursos', icon: 'bi-collection', route: '/resources', roles: ['admin','operator'] },
    { key: 'representatives', label_en: 'Representatives', label_pt: 'Representantes', icon: 'bi-people', route: '/representatives', roles: ['admin','agent'] },
    { key: 'settings', label_en: 'Settings', label_pt: 'Configuração', icon: 'bi-gear', route: '/settings', roles: ['admin'] }
  ];

  constructor(private router: Router, public i18n: TranslationService) {}

  // current year for footer (avoid using `new` in template expressions)
  currentYear = new Date().getFullYear();

  // Filtered menu according to current user role
  get visibleMenu() {
    return this.menuItems.filter(m => m.roles.includes(this.userRole));
  }

  // Localized label helper
  label(m: MenuItem) {
    return this.lang === 'pt' ? m.label_pt : m.label_en;
  }

  changeLang(l: 'en'|'pt'){
    this.i18n.setLang(l);
  }

  // Toggle user role (demo helper) — in real app you'd get this from auth
  setRole(role: Role){
    this.userRole = role;
  }

  logout(){
    // implement real logout flow with auth; for now navigate to root
    this.router.navigateByUrl('/');
  }
}

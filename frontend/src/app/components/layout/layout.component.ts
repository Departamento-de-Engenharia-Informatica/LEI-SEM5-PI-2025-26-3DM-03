import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslationService } from '../../services/i18n/translation.service';
import { AuthService } from '../../services/auth.service';

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
  // Current user role (null until loaded from backend)
  userRole: Role | null = null;

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

  constructor(private router: Router, public i18n: TranslationService, private auth: AuthService) {}

  async ngOnInit(): Promise<void> {
    try {
      const me: any = await this.auth.me();
      // Map backend role names to frontend Role union
      const roleName: string = (me?.role || '').toLowerCase();
      switch (roleName) {
        case 'admin':
          this.userRole = 'admin';
          break;
        case 'logisticsoperator':
        case 'logistics_operator':
        case 'operator':
          this.userRole = 'operator';
          break;
        case 'shippingagentrepresentative':
        case 'shipping_agent_representative':
        case 'agent':
          this.userRole = 'agent';
          break;
        case 'portauthorityofficer':
        case 'port_authority_officer':
        case 'authority':
          this.userRole = 'authority';
          break;
        default:
          // fallback: try to match by contains
          if (roleName.includes('admin')) this.userRole = 'admin';
          else if (roleName.includes('agent')) this.userRole = 'agent';
          else if (roleName.includes('authority')) this.userRole = 'authority';
          else if (roleName.includes('operator')) this.userRole = 'operator';
          else this.userRole = null;
      }
    } catch (err: any) {
      // If not authenticated or forbidden, keep userRole null (no menu).
      console.warn('Could not load user role', err);
      this.userRole = null;
    }
  }

  // current year for footer (avoid using `new` in template expressions)
  currentYear = new Date().getFullYear();

  // Filtered menu according to current user role
  get visibleMenu() {
    if (!this.userRole) return [];
  return this.menuItems.filter(m => m.roles.includes(this.userRole as Role));
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

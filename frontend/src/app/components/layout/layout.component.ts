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
  userName: string | null = null;
  userEmail: string | null = null;
  isAuthenticated = false;
  loginInProgress = false;
  authDeniedReason: string | null = null;

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

  constructor(private router: Router, public i18n: TranslationService, public auth: AuthService) {}

  async ngOnInit(): Promise<void> {
    // Check query string for auth denial reasons or successful login (after redirect from backend)
    let hadAuthOk = false;
    try {
      const params = new URLSearchParams(window.location.search);
      const authStatus = params.get('auth');
      const reason = params.get('reason');
      if (authStatus === 'denied') {
        this.authDeniedReason = reason ?? 'access_denied';
      }
      // If auth=ok, clean up the query string so it doesn't persist
      if (authStatus === 'ok') {
        hadAuthOk = true;
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch { /* ignore in non-browser environments */ }

    // Try to load user info
    try {
      const me: any = await this.auth.me();
      this.isAuthenticated = true;
      this.userName = me?.name ?? null;
      this.userEmail = me?.email ?? null;
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
      console.log('[LayoutComponent] User authenticated:', { name: this.userName, role: this.userRole });
    } catch (err: any) {
      // If not authenticated or forbidden, keep userRole null (no menu).
      console.warn('[LayoutComponent] Could not load user role', err);
      this.userRole = null;
      
      // If we had ?auth=ok but still got 401, it might be a cookie/timing issue
      // Try a full reload after a short delay to give browser time to set cookies
      if (hadAuthOk) {
        console.log('[LayoutComponent] Had auth=ok but me() failed, will retry with page reload in 1s...');
        setTimeout(() => {
          if (!this.isAuthenticated) {
            console.log('[LayoutComponent] Still not authenticated, forcing page reload...');
            window.location.reload();
          }
        }, 1000);
      }
    }
  }

  // current year for footer (avoid using `new` in template expressions)
  currentYear = new Date().getFullYear();

  // Filtered menu according to current user role
  get visibleMenu() {
    // only show menu when user is authenticated and has a role
    if (!this.isAuthenticated || !this.userRole) return [];
    return this.menuItems.filter(m => m.roles.includes(this.userRole as Role));
  }

  // Localized label helper
  label(m: MenuItem) {
    return this.lang === 'pt' ? m.label_pt : m.label_en;
  }

  changeLang(l: 'en'|'pt'){
    this.i18n.setLang(l);
  }


  // Called by the Login button to start the login flow and show a transient UI state
  login(){
    this.loginInProgress = true;
    try{
      this.auth.login();
    } catch(e) {
      console.error('login redirect failed', e);
      this.loginInProgress = false;
    }
  }

  logout(){
    // call auth logout which triggers backend sign-out
    this.auth.logout();
  }
}

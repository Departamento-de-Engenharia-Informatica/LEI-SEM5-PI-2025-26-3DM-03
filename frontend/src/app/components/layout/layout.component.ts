import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslationService } from '../../services/i18n/translation.service';
import { AuthService } from '../../services/auth/auth.service';
import { Subscription } from 'rxjs';
import { LoginComponent } from '../../pages/login/login.component';
import { ToastContainerComponent } from '../toast/toast-container.component';
//import { HttpClientModule } from '@angular/common/http';

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
  imports: [CommonModule, RouterModule, LoginComponent, ToastContainerComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit, OnDestroy {
 
  activeSubmenu: string | null = null;

  toggleSubmenu(key: string) {
    this.activeSubmenu = this.activeSubmenu === key ? null : key;
  }

  // Sidebar UI state: collapsed means compact sidebar; hotspotOpen true while hovering left edge
  sidebarCollapsed: boolean = false; // true => hidden (closed) unless hotspotOpen
  hotspotOpen: boolean = false;

  // computed convenience: when true, sidebar should appear expanded
  get sidebarExpanded(): boolean { return !this.sidebarCollapsed || this.hotspotOpen; }
 
  // Language comes from the translation service
  get lang() { return this.i18n.getLang(); }

  // Application title via translation service
  get title() { return this.i18n.t('title'); }

  // Define menu items with roles
  menuItems: MenuItem[] = [
    // Dashboard open to all roles (admin also implicit)
    { key: 'dashboard', label_en: 'Dashboard', label_pt: 'Painel', icon: 'bi-speedometer2', route: '/dashboard', roles: ['admin','operator','agent','authority'] },
    // Vessel & dock management per user stories: Port Authority Officer (authority) + admin
    // Use inline SVG for ship to avoid CDN hiccups rendering 'bi-ship'
    { key: 'vessels', label_en: 'Vessels', label_pt: 'Navios', icon: 'svg-ship', route: '', roles: ['admin','authority'] },
    { key: 'docks', label_en: 'Docks', label_pt: 'Docas', icon: 'bi-box-seam', route: '/docks', roles: ['admin','authority'] },
    { key: 'storage_areas', label_en: 'Storage Areas', label_pt: 'Áreas de Armazenamento', icon: 'bi-inboxes', route: '/storage-areas', roles: ['admin','authority'] },
    // Resources, staff, qualifications -> Logistics Operator + admin
    { key: 'resources', label_en: 'Resources', label_pt: 'Recursos', icon: 'bi-collection', route: '/resources', roles: ['admin','operator'] },
    // Representatives management by Port Authority Officer + admin (agent may have separate limited view later)
    { key: 'representatives', label_en: 'Representatives', label_pt: 'Representantes', icon: 'bi-people', route: '/representatives', roles: ['admin','authority'] },
    // Admin settings only
    { key: 'settings', label_en: 'Settings', label_pt: 'Configuração', icon: 'bi-gear', route: '/settings', roles: ['admin'] }
  ];
  // menu currently shown in the template — updated when auth state changes
  displayedMenu: MenuItem[] = [];
  private subs: Subscription | null = null;

  constructor(public i18n: TranslationService, public auth: AuthService, private cdr: ChangeDetectorRef, private router: Router) {}

  avatarUrl: string = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect width=%2240%22 height=%2240%22 rx=%2220%22 fill=%22%2302284A%22/><text x=%2250%25%22 y=%2256%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2214%22 fill=%22white%22 font-family=%22Inter,Arial%22>%3F</text></svg>';

  ngOnInit(): void {
    // initialize displayed menu according to current user (may be null at startup)
    this.updateDisplayedMenu();
    this.loadAvatar();

    window.addEventListener('storage', this.onStorage);

    this.router.events.subscribe(() => {
      this.activeSubmenu = null;
    });

    // subscribe to loggedIn changes — update menu when login state changes
    this.subs = this.auth.loggedIn$.subscribe((v) => {
      console.log('[Layout] loggedIn$ emission=', v, 'auth.user=', this.auth.user);
      this.updateDisplayedMenu();
      // force an immediate check so UI updates even if emitted outside Angular (safety)
      try { this.cdr.detectChanges(); } catch {}
    });
  }

  onMenuClick(item: MenuItem, ev?: Event) {
    // Para itens normais deixamos o routerLink agir.
    // Só interceptamos o clique para o item com submenu (vessels).
    if (item.key === 'vessels') {
      ev?.preventDefault();
      ev?.stopPropagation();
      this.toggleSubmenu(item.key);
    } else {
      this.activeSubmenu = null;
    }
  }


  ngOnDestroy(): void {
    this.subs?.unsubscribe();
    this.subs = null;
    window.removeEventListener('storage', this.onStorage);
  }
 

  // current year for footer (avoid using `new` in template expressions)
  currentYear = new Date().getFullYear();


  private updateDisplayedMenu() {
    const u = this.auth.user;
    console.log('[Layout] updateDisplayedMenu: auth.user=', u);
    if (!u || !u.role) {
      this.displayedMenu = [];
    } else {
      const r = u.role as Role;
      // Admin sees all regardless of listed roles
      this.displayedMenu = r === 'admin' ? this.menuItems.slice() : this.menuItems.filter(m => m.roles.includes(r));
    }
    console.log('[Layout] displayedMenu=', this.displayedMenu.map(x => x.key));
  }

  private loadAvatar(){
    try {
      const stored = localStorage.getItem('userAvatar');
      if (stored) this.avatarUrl = stored;
    } catch {}
  }

  private onStorage = (e: StorageEvent) => {
    if (e.key === 'userAvatar') { this.loadAvatar(); try { this.cdr.detectChanges(); } catch {} }
  };

  

  // Localized label helper
  label(m: MenuItem) {
    return this.lang === 'pt' ? m.label_pt : m.label_en;
  }

  changeLang(l: 'en'|'pt'){
    this.i18n.setLang(l);
  }


 
  logout(){
    // call auth logout which triggers backend sign-out
    this.auth.logout();
  }

  // Toggle sidebar (hamburger): open if closed, close if open
  toggleSidebar(){
    this.sidebarCollapsed = !this.sidebarCollapsed;
    // make sure Angular updates view
    try { this.cdr.detectChanges(); } catch {}
  }

  // Hotspot handlers: when user hovers the left edge we show sidebar temporarily
  openHotspot(){
    this.hotspotOpen = true;
    try { this.cdr.detectChanges(); } catch {}
  }

  closeHotspot(){
    this.hotspotOpen = false;
    try { this.cdr.detectChanges(); } catch {}
  }

}

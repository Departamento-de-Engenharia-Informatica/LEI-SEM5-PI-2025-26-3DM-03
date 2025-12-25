import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslationService } from '../../services/i18n/translation.service';
import { AuthService } from '../../services/auth/auth.service';
import { Subscription } from 'rxjs';
import { LoginComponent } from '../../pages/login/login.component';
import { ToastContainerComponent } from '../toast/toast-container.component';
//import { HttpClientModule } from '@angular/common/http';

type Role = 'admin' | 'operator' | 'logistics-operator' | 'agent' | 'authority';

interface MenuChild {
  key: string;
  label_en: string;
  label_pt: string;
  route: string;
  icon?: string;
}

interface MenuItem {
  key: string;
  label_en: string;
  label_pt: string;
  icon?: string; // css class or inline svg name
  route?: string;
  roles: Role[];
  children?: MenuChild[];
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
    { key: 'shipping_agents', label_en: 'Shipping Agents', label_pt: 'Agentes de Navegação', icon: 'bi-building', route: '/shipping-agents', roles: ['admin','authority'] },
    // Vessel & dock management per user stories: Port Authority Officer (authority) + admin
    // Use inline SVG for ship to avoid CDN hiccups rendering 'bi-ship'
    { key: 'vessels', label_en: 'Vessels', label_pt: 'Navios', icon: 'svg-ship', route: '', roles: ['admin','authority'], children: [
      { key: 'vessels_list', label_en: 'Vessels', label_pt: 'Navios', route: '/vessels' },
      { key: 'vessel_types', label_en: 'Vessel Types', label_pt: 'Tipos de Navio', route: '/vessel-types' },
      { key: 'visit_notifications', label_en: 'Visit Notifications', label_pt: 'Notificações de Visita', route: '/vessel-visit-notifications' }
    ] },
    { key: 'docks', label_en: 'Docks', label_pt: 'Docas', icon: 'bi-box-seam', route: '/docks', roles: ['admin','authority'] },
    { key: 'storage_areas', label_en: 'Storage Areas', label_pt: 'Áreas de Armazenamento', icon: 'bi-inboxes', route: '/storage-areas', roles: ['admin','authority'] },
    // Resources, staff, qualifications -> Logistics Operator + admin
    { key: 'resources', label_en: 'Resources', label_pt: 'Recursos', icon: 'bi-collection', route: '/resources', roles: ['admin','operator'] },
    { key: 'qualifications', label_en: 'Qualifications', label_pt: 'Qualificações', icon: 'bi-award', route: '/qualifications', roles: ['admin','operator'] },
    { key: 'public_resources', label_en: 'Shared Resources', label_pt: 'Recursos Partilhados', icon: 'bi-folder2-open', route: '/public-resources', roles: ['admin','operator','agent','authority'] },
    { key: 'scheduling', label_en: 'Scheduling', label_pt: 'Planeamento', icon: 'bi-calendar4-week', route: '/scheduling', roles: ['admin','operator'] },
    { key: 'staff', label_en: 'Staff', label_pt: 'Equipa', icon: 'bi-person-badge', route: '/staff', roles: ['admin','operator'] },
    { key: 'oem_operation_plans', label_en: 'Operation Plans', label_pt: 'Planos de Operação', icon: 'bi-diagram-3', route: '/oem/operation-plans', roles: ['admin','logistics-operator'] },
    { key: 'oem_resource_allocation', label_en: 'Resource Allocation', label_pt: 'Alocação de Recursos', icon: 'bi-graph-up', route: '/oem/resource-allocation', roles: ['admin','logistics-operator'] },
    { key: 'oem_vve_history', label_en: 'Visit Executions', label_pt: 'Execuções de Visita', icon: 'bi-clock-history', route: '/oem/vessel-visit-executions', roles: ['admin','logistics-operator'] },
    // Representatives management by Port Authority Officer + admin (agent may have separate limited view later)
    { key: 'representatives', label_en: 'Representatives', label_pt: 'Representantes', icon: 'bi-people', route: '/representatives', roles: ['admin','authority'] },
  // Port 3D
    { key: 'experiences_3d', label_en: '3D Experiences', label_pt: 'Experiências 3D', icon: 'bi-cube', roles: ['admin','operator','agent','authority'], children: [
      { key: 'port3d', label_en: 'Port 3D', label_pt: 'Porto 3D', route: '/port', icon: 'bi-map' },
      { key: 'house_3d', label_en: 'House 3D', label_pt: 'Casa 3D', route: '/house-3d', icon: 'bi-building' },
      { key: 'craneDemo', label_en: 'Crane Model', label_pt: 'Grua STS', route: '/crane', icon: 'bi-lightning' },
      { key: 'truck3d', label_en: 'Truck 3D', label_pt: 'Camião DAF', route: '/truck', icon: 'bi-truck' },
      { key: 'cargoVessel3d', label_en: 'Cargo Vessel', label_pt: 'Navio Porta-Contentores', route: '/cargo-vessel', icon: 'bi-ship' },
      { key: 'ground3d', label_en: 'Ground Module', label_pt: 'Chão 3D', route: '/ground', icon: 'bi-aspect-ratio' },
      { key: 'cube', label_en: '3D Demo', label_pt: '3D Demo', route: '/cube', icon: 'bi-box' },
      { key: 'final_3d', label_en: '3D Final', label_pt: '3D Final', route: '/final-3d', icon: 'bi-bricks' }
    ] },
    // Admin settings only
    { key: 'settings', label_en: 'Settings', label_pt: 'Configuração', icon: 'bi-gear', route: '/settings', roles: ['admin'] },
  ];
  // menu currently shown in the template — updated when auth state changes
  displayedMenu: MenuItem[] = [];
  private subs: Subscription | null = null;

  constructor(public i18n: TranslationService, public auth: AuthService, private cdr: ChangeDetectorRef, private router: Router) {}

  avatarUrl: string = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect width=%2240%22 height=%2240%22 rx=%2220%22 fill=%22%2302284A%22/><text x=%2250%25%22 y=%2256%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2214%22 fill=%22white%22 font-family=%22Inter,Arial%22>%3F</text></svg>';
  avatarModalOpen = false;

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
      this.loadAvatar();
      // force an immediate check so UI updates even if emitted outside Angular (safety)
      try { this.cdr.detectChanges(); } catch {}
    });
  }

  onMenuClick(item: MenuItem, ev?: Event) {
    // Para itens com submenu evitamos navegação imediata e alternamos o submenu.
    if (item.children?.length) {
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
    if (!u || (!u.role && !Array.isArray(u.roles))) {
      this.displayedMenu = [];
    } else {
      const roleSet = new Set<string>();
      if (u.role) {
        roleSet.add(u.role);
      }
      if (Array.isArray(u.roles)) {
        for (const r of u.roles) {
          if (r) {
            roleSet.add(r);
          }
        }
      }

      if (roleSet.has('admin')) {
        this.displayedMenu = this.menuItems.slice();
      } else {
        this.displayedMenu = this.menuItems.filter((m) => m.roles.some((role) => roleSet.has(role)));
      }
    }
    console.log('[Layout] displayedMenu=', this.displayedMenu.map(x => x.key));
  }

  private loadAvatar(){
    try {
      // Prefer live user avatar from auth state
      const live = this.auth.user?.avatarUrl;
      if (live) {
        this.avatarUrl = live;
        return;
      }
      const stored = localStorage.getItem('userAvatar');
      if (stored) {
        this.avatarUrl = stored;
      }
    } catch {}
  }

  private onStorage = (e: StorageEvent) => {
    if (e.key === 'userAvatar') { this.loadAvatar(); try { this.cdr.detectChanges(); } catch {} }
  };

  // Allow a public minimal route for the 3D viewer
  get isViewerRoute(): boolean {
    try {
      return this.router.url.startsWith('/viewer');
    } catch {
      return false;
    }
  }

  

  private localizeLabel(entry: { label_en: string; label_pt: string }) {
    return this.lang === 'pt' ? entry.label_pt : entry.label_en;
  }

  // Localized label helper
  label(m: MenuItem) {
    return this.localizeLabel(m);
  }

  childLabel(child: MenuChild) {
    return this.localizeLabel(child);
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

  openAvatarModal(){
    if (!this.avatarUrl) return;
    this.avatarModalOpen = true;
    // focus trap start could be added later
  }

  closeAvatarModal(){
    this.avatarModalOpen = false;
  }

}

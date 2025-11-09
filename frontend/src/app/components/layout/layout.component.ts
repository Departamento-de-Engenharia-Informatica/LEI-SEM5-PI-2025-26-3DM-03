import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslationService } from '../../services/i18n/translation.service';
import { AuthService } from '../../services/auth/auth.service';
import { Subscription } from 'rxjs';
import { LoginComponent } from '../../pages/login/login.component';
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
  imports: [CommonModule, RouterModule, LoginComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit, OnDestroy {
 
  // Language comes from the translation service
  get lang() { return this.i18n.getLang(); }

  // Application title via translation service
  get title() { return this.i18n.t('title'); }

  // Define menu items with roles
  menuItems: MenuItem[] = [
    { key: 'dashboard', label_en: 'Dashboard', label_pt: 'Painel', icon: 'bi-speedometer2', route: '/dashboard', roles: ['admin','operator','agent','authority'] },
    { key: 'vessels', label_en: 'Vessels', label_pt: 'Navios', icon: 'bi-ship', route: '/vessels', roles: ['admin','operator'] },
    { key: 'docks', label_en: 'Docks', label_pt: 'Docas', icon: 'bi-box-seam', route: '/docks', roles: ['admin','authority'] },
    { key: 'storage_areas', label_en: 'Storage Areas', label_pt: 'Áreas de Armazenamento', icon: 'bi-inboxes', route: '/storage-areas', roles: ['admin','operator'] },
    { key: 'resources', label_en: 'Resources', label_pt: 'Recursos', icon: 'bi-collection', route: '/resources', roles: ['admin','operator'] },
    { key: 'representatives', label_en: 'Representatives', label_pt: 'Representantes', icon: 'bi-people', route: '/representatives', roles: ['admin','agent'] },
    { key: 'settings', label_en: 'Settings', label_pt: 'Configuração', icon: 'bi-gear', route: '/settings', roles: ['admin'] }
  ];
  // menu currently shown in the template — updated when auth state changes
  displayedMenu: MenuItem[] = [];
  private subs: Subscription | null = null;

  constructor(public i18n: TranslationService, public auth: AuthService, private cdr: ChangeDetectorRef, private router: Router) {}

  ngOnInit(): void {
    // initialize displayed menu according to current user (may be null at startup)
    this.updateDisplayedMenu();

    // subscribe to loggedIn changes — update menu when login state changes
    this.subs = this.auth.loggedIn$.subscribe((v) => {
      console.log('[Layout] loggedIn$ emission=', v, 'auth.user=', this.auth.user);
      this.updateDisplayedMenu();
      // force an immediate check so UI updates even if emitted outside Angular (safety)
      try { this.cdr.detectChanges(); } catch {}
    });
  }

  onMenuClick(item: MenuItem, ev?: Event) {
    console.log('[Layout] menu click', item.key, item.route, 'auth.user=', this.auth.user);
    try {
      // use router.navigate as a robust fallback in case routerLink binding isn't working
      this.router.navigate([item.route]);
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    } catch (e) {
      console.error('[Layout] navigation failed', e);
    }
  }

  ngOnDestroy(): void {
    this.subs?.unsubscribe();
    this.subs = null;
  }
 

  // current year for footer (avoid using `new` in template expressions)
  currentYear = new Date().getFullYear();

 

  private updateDisplayedMenu() {
    const u = this.auth.user;
    console.log('[Layout] updateDisplayedMenu: auth.user=', u);
    if (!u || !u.role) {
      this.displayedMenu = [];
    } else {
      this.displayedMenu = this.menuItems.filter(m => m.roles.includes(u.role as Role));
    }
    console.log('[Layout] displayedMenu=', this.displayedMenu.map(x => x.key));
  }

  

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

}

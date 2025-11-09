import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth/auth.service';
import { LayoutComponent } from './components/layout/layout.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, LayoutComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements AfterViewInit {

  constructor(public auth: AuthService, private router: Router) {}

  async ngAfterViewInit(): Promise<void> {
    console.log('App ngAfterViewInit called');

    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location?.search ?? '');
      const authStatus = params.get('auth') ?? '';
      const reason = params.get('reason') ?? '';

      // Caso o login tenha sido negado
      if (authStatus === 'denied') {
        this.auth.authDeniedReason = reason || 'access_denied';
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
          await this.router.navigate(['/login']);
        } catch (err) {
          console.error('Navigation to /login failed:', err);
        }
      }

      // Caso o login tenha sido aceite
      else if (authStatus === 'ok') {
        await this.auth.checkAuth();
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
          await this.router.navigate(['/dashboard']);
        } catch (err) {
          console.error('Navigation to /dashboard failed:', err);
        }
      }

      // Caso normal — sem parâmetros de autenticação
      else {
        await this.auth.checkAuth();
      }

    } catch (err) {
      console.error('Error in ngAfterViewInit:', err);
    }
  }
}

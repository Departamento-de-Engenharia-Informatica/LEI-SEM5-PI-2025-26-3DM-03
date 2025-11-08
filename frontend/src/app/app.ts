import { Component, AfterViewInit  } from '@angular/core'; 
import { AuthService } from './services/auth/auth.service';
import { Router, RouterOutlet } from '@angular/router'; 
import { CommonModule } from '@angular/common'; 
import { LayoutComponent } from './components/layout/layout.component';
 

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ CommonModule, RouterOutlet, LayoutComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements AfterViewInit  {
   
  constructor(public auth: AuthService, private router: Router ) {}
  
  async ngAfterViewInit(): Promise<void> {
    console.log('App ngAfterViewInit called');
    // Make sure we're in the browser environment
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location?.search ?? '');
      const authStatus = params.get('auth') ?? '';
      const reason = params.get('reason') ?? '';

      // If the auth flow returned an explicit denied state, handle it and stop
      if (authStatus === 'denied') {
        this.auth.authDeniedReason = reason || 'access_denied';
         window.history.replaceState({}, document.title, window.location.pathname);
       try { this.router.navigate(['/']); } catch {}
      }else if (authStatus === 'ok') {  
        await this.auth.checkAuth();
         window.history.replaceState({}, document.title, window.location.pathname);
        try { this.router.navigate(['/']); } catch {}
      }
 
    } catch (err) {
      console.error('Error in ngOnInit:', err);
    }
  }
}

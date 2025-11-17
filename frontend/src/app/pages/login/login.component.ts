import { AfterViewInit, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/i18n/translate.mock.module';
import { AuthService } from '../../services/auth/auth.service';
import { TranslationService } from '../../services/i18n/translation.service';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements AfterViewInit {

  constructor(public i18n: TranslationService, public auth: AuthService, private cdr: ChangeDetectorRef) {}

  // Inicia o fluxo de login
  login(): void {
    try {
      this.auth.login();
    } catch (e) {
      console.error('login redirect failed', e);
    }
  }

  ngAfterViewInit(): void {
    // Evita ExpressionChangedAfterItHasBeenChecked ao atualizar authDeniedReason após a primeira verificação
    queueMicrotask(() => {
      try { this.cdr.detectChanges(); } catch {}
    });
  }
}

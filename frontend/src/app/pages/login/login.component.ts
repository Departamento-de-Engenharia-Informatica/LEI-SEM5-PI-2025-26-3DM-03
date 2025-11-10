import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/i18n/translate.mock.module';
import { AuthService } from '../../services/auth/auth.service';
import { TranslationService } from '../../services/i18n/translation.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnDestroy {
  avatarPreview: string | null = null;
  private _currentObjectUrl: string | null = null;
  private _base64Avatar: string | null = null;

  constructor(public i18n: TranslationService, public auth: AuthService) {}

  // Inicia o fluxo de login
  login(): void {
    try {
      this.auth.login();
    } catch (e) {
      console.error('login redirect failed', e);
    }
  }

  onFileSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    try {
      // limpar URL anterior
      if (this._currentObjectUrl) {
        URL.revokeObjectURL(this._currentObjectUrl);
        this._currentObjectUrl = null;
      }

      const url = URL.createObjectURL(file);
      this._currentObjectUrl = url;
      this.avatarPreview = url;

      // Converter para base64 e persistir localmente (para mostrar no header pós-login)
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        this._base64Avatar = result;
        try { localStorage.setItem('userAvatar', result); } catch {}
      };
      reader.onerror = (e) => console.error('Avatar base64 failed', e);
      reader.readAsDataURL(file);
    } catch (e) {
      console.error('Failed to create preview', e);
    }
  }

  ngOnDestroy(): void {
    if (this._currentObjectUrl) {
      URL.revokeObjectURL(this._currentObjectUrl);
      this._currentObjectUrl = null;
    }
  }
}

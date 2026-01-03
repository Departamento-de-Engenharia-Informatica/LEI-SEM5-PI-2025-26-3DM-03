import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { PrivacyPolicyService } from '../../services/privacy-policy/privacy-policy.service';
import { PrivacyPolicy } from '../../models/privacy-policy';
import { ToastService } from '../../components/toast/toast.service';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss']
})
export class PrivacyPolicyComponent implements OnInit {
  current: PrivacyPolicy | null = null;
  history: PrivacyPolicy[] = [];
  loading = false;
  saving = false;
  error: string | null = null;

  title = 'Política de Privacidade';
  content = '';

  constructor(
    public auth: AuthService,
    private service: PrivacyPolicyService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      try {
        this.current = await this.service.getCurrent();
        this.title = this.current?.title || this.title;
      } catch (err: any) {
        if (err?.status === 404) {
          this.current = null;
        } else {
          throw err;
        }
      }
      if (this.isAdmin) {
        this.history = await this.service.getHistory();
      }
      try {
        await this.service.acknowledge();
      } catch {}
    } catch (err: any) {
      this.error = err?.message || 'Falha ao carregar a política.';
    } finally {
      this.loading = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  async publish(): Promise<void> {
    if (!this.content.trim()) {
      this.toast.error('O conteúdo é obrigatório.');
      return;
    }
    this.saving = true;
    try {
      const created = await this.service.publish({
        title: this.title?.trim() || 'Política de Privacidade',
        content: this.content.trim()
      });
      this.toast.success('Política publicada.');
      this.current = created;
      this.content = '';
      if (this.isAdmin) {
        this.history = await this.service.getHistory();
      }
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Falha ao publicar a política.';
      this.toast.error(message);
    } finally {
      this.saving = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  formatDate(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-PT');
  }
}

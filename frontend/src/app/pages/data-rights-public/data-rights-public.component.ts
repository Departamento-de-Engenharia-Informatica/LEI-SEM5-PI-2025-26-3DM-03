import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DataRightsService } from '../../services/data-rights/data-rights.service';
import { ToastService } from '../../components/toast/toast.service';
import { ToastContainerComponent } from '../../components/toast/toast-container.component';

@Component({
  selector: 'app-data-rights-public',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ToastContainerComponent],
  templateUrl: './data-rights-public.component.html',
  styleUrls: ['./data-rights-public.component.scss']
})
export class DataRightsPublicComponent {
  name = '';
  email = '';
  requestType: 'access' | 'rectification' | 'deletion' = 'access';
  details = '';
  submitting = false;

  constructor(
    private dataRights: DataRightsService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  async submit(): Promise<void> {
    const name = this.name.trim();
    const email = this.email.trim();
    if (!name || !email) {
      this.toast.error('Nome e email sao obrigatorios.');
      return;
    }
    if (!email.includes('@')) {
      this.toast.error('Indica um email valido.');
      return;
    }
    this.submitting = true;
    try {
      await this.dataRights.createPublicRequest({
        name,
        email,
        type: this.requestType,
        details: this.details.trim() || undefined
      });
      this.toast.success('Pedido registado com sucesso.');
      this.name = '';
      this.email = '';
      this.requestType = 'access';
      this.details = '';
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Falha ao submeter pedido.';
      this.toast.error(message);
    } finally {
      this.submitting = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }
}

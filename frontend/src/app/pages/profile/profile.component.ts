import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth/auth.service';
import { ToastService } from '../../components/toast/toast.service';
import { DataRightsService } from '../../services/data-rights/data-rights.service';
import { DataRightsRequest, PublicDataRightsRequest } from '../../models/data-rights';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  requestType: 'access' | 'rectification' | 'deletion' = 'access';
  selectedFields: { name: boolean; email: boolean; role: boolean } = { name: false, email: false, role: false };
  deleteName = false;
  rectification = { name: '', email: '', role: '' };
  rolesCatalog = [
    { value: 'Admin', label: 'Admin' },
    { value: 'ExternalIamProvider', label: 'ExternalIamProvider' },
    { value: 'PortAuthorityOfficer', label: 'PortAuthorityOfficer' },
    { value: 'ShippingAgentRepresentative', label: 'ShippingAgentRepresentative' },
    { value: 'LogisticsOperator', label: 'LogisticsOperator' }
  ];
  details = '';
  submitting = false;
  myRequests: DataRightsRequest[] = [];
  allRequests: DataRightsRequest[] = [];
  publicRequests: PublicDataRightsRequest[] = [];
  expandedRequests = new Set<number>();
  rejectReasons: Record<number, string> = {};

  constructor(
    public auth: AuthService,
    private dataRights: DataRightsService,
    private toast: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  async loadRequests(): Promise<void> {
    try {
      this.myRequests = await this.dataRights.listMyRequests();
      if (this.isAdmin) {
        this.allRequests = await this.dataRights.listAllRequests();
        this.publicRequests = await this.dataRights.listPublicRequests();
      }
      try { this.cdr.detectChanges(); } catch {}
    } catch {}
  }

  async downloadData(format: 'json' | 'pdf'): Promise<void> {
    try {
      const fields = Object.entries(this.selectedFields)
        .filter(([, value]) => value)
        .map(([key]) => key);
      const blob = await this.dataRights.exportPersonalData(format, fields);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `personal-data.${format}`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      this.toast.success('Download iniciado.');
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Falha ao exportar dados.';
      this.toast.error(message);
    }
  }

  async submitRequest(): Promise<void> {
    this.submitting = true;
    try {
      let fields: string[] = [];
      let details = this.details.trim();
      if (this.requestType === 'access') {
        fields = Object.entries(this.selectedFields)
          .filter(([, value]) => value)
          .map(([key]) => key);
      } else if (this.requestType === 'rectification') {
        const rectFields: string[] = [];
        if (this.rectification.name.trim()) rectFields.push('name');
        if (this.rectification.email.trim()) rectFields.push('email');
        if (this.rectification.role.trim()) rectFields.push('role');
        fields = rectFields;
        const payload = {
          requested: {
            name: this.rectification.name.trim() || null,
            email: this.rectification.email.trim() || null,
            role: this.rectification.role.trim() || null
          },
          notes: details
        };
        details = JSON.stringify(payload);
      } else if (this.requestType === 'deletion') {
        fields = this.deleteName ? ['name'] : [];
      }
      await this.dataRights.createRequest({
        type: this.requestType,
        fields,
        details
      });
      this.toast.success('Pedido registado com sucesso.');
      this.selectedFields = { name: false, email: false, role: false };
      this.deleteName = false;
      this.rectification = { name: '', email: '', role: '' };
      this.details = '';
      await this.loadRequests();
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Falha ao submeter pedido.';
      this.toast.error(message);
    } finally {
      this.submitting = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  toggleRequest(id: number): void {
    if (this.expandedRequests.has(id)) {
      this.expandedRequests.delete(id);
    } else {
      this.expandedRequests.add(id);
    }
  }

  parseDetails(details?: string | null): { requested?: { name?: string | null; email?: string | null; role?: string | null }; notes?: string } | null {
    if (!details) return null;
    const trimmed = details.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  statusLabel(status: string): string {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'completed' || normalized === 'respondido') return 'Respondido';
    if (normalized === 'pending' || normalized === 'submitted' || normalized === 'a aguardar resposta') return 'A aguardar resposta';
    if (normalized === 'rejected') return 'Recusado';
    return status;
  }

  async updateRequestStatus(request: DataRightsRequest, status: string): Promise<void> {
    try {
      const reason = this.rejectReasons[request.id];
      if (status === 'Rejected' && !reason?.trim()) {
        this.toast.error('Indica o motivo da recusa.');
        return;
      }
      await this.dataRights.updateStatus(request.id, status, reason);
      this.toast.success('Estado atualizado.');
      await this.loadRequests();
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Falha ao atualizar estado.';
      this.toast.error(message);
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

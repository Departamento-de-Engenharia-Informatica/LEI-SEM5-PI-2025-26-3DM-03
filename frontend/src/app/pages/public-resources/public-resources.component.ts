import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedResource } from '../../models/public-resource';
import { PublicResourcesService } from '../../services/public-resources/public-resources.service';
import { AuthService } from '../../services/auth/auth.service';
import { ToastService } from '../../components/toast/toast.service';

@Component({
  selector: 'app-public-resources',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './public-resources.component.html',
  styleUrls: ['./public-resources.component.scss']
})
export class PublicResourcesComponent implements OnInit {
  resources: SharedResource[] = [];
  loading = false;
  uploading = false;
  deletingId: number | null = null;
  error: string | null = null;
  description = '';
  selectedFile: File | null = null;

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  constructor(
    private service: PublicResourcesService,
    public auth: AuthService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  get canManage(): boolean {
    return this.auth.isAdmin();
  }

  async ngOnInit() {
    await this.loadResources();
  }

  async loadResources() {
    this.loading = true;
    this.error = null;
    try {
      this.resources = await this.service.list();
    } catch (err: any) {
      this.error = err?.message || 'Erro ao carregar recursos partilhados.';
    } finally {
      this.loading = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    this.selectedFile = file ?? null;
  }

  async upload() {
    if (!this.selectedFile) {
      this.toast.error('Selecione um ficheiro para carregar.');
      return;
    }

    this.uploading = true;
    try {
      await this.service.upload(this.selectedFile, this.description.trim() || null);
      this.toast.success('Ficheiro carregado com sucesso.');
      this.description = '';
      this.selectedFile = null;
      if (this.fileInput?.nativeElement) {
        this.fileInput.nativeElement.value = '';
      }
      await this.loadResources();
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Falha ao carregar o ficheiro.';
      this.toast.error(message);
    } finally {
      this.uploading = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  async download(resource: SharedResource) {
    try {
      const blob = await this.service.download(resource.id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = resource.fileName || 'download';
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Falha ao descarregar o ficheiro.';
      this.toast.error(message);
    }
  }

  async remove(resource: SharedResource) {
    if (!this.canManage) return;
    if (this.deletingId === resource.id) return;
    if (!confirm(`Remover ${resource.fileName}?`)) return;

    this.deletingId = resource.id;
    try {
      await this.service.remove(resource.id);
      this.toast.success('Recurso removido.');
      await this.loadResources();
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Falha ao remover o recurso.';
      this.toast.error(message);
    } finally {
      this.deletingId = null;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  formatSize(bytes: number): string {
    if (!bytes && bytes !== 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  formatDate(value: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-PT');
  }

  trackById(_: number, item: SharedResource) {
    return item.id;
  }
}

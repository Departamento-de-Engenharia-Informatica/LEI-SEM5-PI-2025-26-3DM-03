import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/i18n/translate.mock.module';
import { RepresentativesService } from '../../services/representatives/representatives.service';
import { TranslationService } from '../../services/i18n/translation.service';
import { ToastService } from '../../components/toast/toast.service';
import { CreateRepresentativeDTO, RepresentativeDTO, UpdateRepresentativeDTO } from '../../models/representative';

type SortKey = 'name' | 'citizenID' | 'nationality' | 'email' | 'phoneNumber' | 'isActive';

@Component({
  selector: 'app-representatives',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './representatives.component.html',
  styleUrls: ['./representatives.component.scss']
})
export class RepresentativesComponent implements OnInit {
  // Context
  taxNumber: number | null = null;

  // Data + UI state
  reps: RepresentativeDTO[] = [];
  filtered: RepresentativeDTO[] = [];
  loading = false;
  error: string | null = null;

  // Filter/sort
  q = '';
  sortKey: SortKey = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  // Create/edit
  newRep: CreateRepresentativeDTO = { name: '', citizenID: '', nationality: '', email: '', phoneNumber: '' };
  editing: (UpdateRepresentativeDTO & { id: number }) | null = null;

  constructor(private svc: RepresentativesService, private cdr: ChangeDetectorRef, private toast: ToastService, private i18n: TranslationService) {}

  async ngOnInit() {}

  async load() {
    if (!this.taxNumber) { this.error = 'Insira o NIF do Agente.'; return; }
    this.loading = true; this.error = null;
    try {
      this.reps = await this.svc.getAll(this.taxNumber);
      this.applyFilterSort();
    } catch (e: any) {
      this.error = (e?.message || 'Erro ao carregar representantes') + ' — verifica se a API está a correr e o NIF existe.';
    } finally {
      this.loading = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  applyFilterSort() {
    const q = this.q.trim().toLowerCase();
    let arr = this.reps.slice();
    if (q) {
      arr = arr.filter(r =>
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.citizenID ?? '').toLowerCase().includes(q) ||
        (r.nationality ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.phoneNumber ?? '').toLowerCase().includes(q)
      );
    }
    const dir = this.sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = (a[this.sortKey] as any) ?? '';
      const vb = (b[this.sortKey] as any) ?? '';
      if (typeof va === 'boolean' && typeof vb === 'boolean') return (Number(va) - Number(vb)) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    this.filtered = arr;
  }

  changeSort(k: SortKey) {
    if (this.sortKey === k) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortKey = k; this.sortDir = 'asc'; }
    this.applyFilterSort();
  }

  async create() {
    if (!this.taxNumber) { this.error = 'Insira o NIF do Agente.'; return; }
    this.error = null;
    try {
      const created = await this.svc.create(this.taxNumber, this.newRep);
      this.reps.unshift(created);
      this.applyFilterSort();
      this.newRep = { name: '', citizenID: '', nationality: '', email: '', phoneNumber: '' };
      try { this.cdr.detectChanges(); } catch {}
      this.toast.success(this.i18n.t('reps.toasts.created'));
    } catch (e: any) { this.error = e?.message || 'Erro ao criar representante'; }
  }

  openEdit(r: RepresentativeDTO) {
    this.editing = {
      id: r.id,
      name: r.name,
      citizenID: r.citizenID,
      nationality: r.nationality,
      email: r.email,
      phoneNumber: r.phoneNumber,
      isActive: r.isActive
    };
  }
  closeEdit() { this.editing = null; }

  async saveEdit() {
    if (!this.editing) { this.error = 'Dados inválidos.'; return; }
    const tax = this.taxNumber;
    if (!tax) { this.error = 'Insira o NIF do Agente.'; return; }
    this.error = null;

    // Otimista: aplica alterações localmente antes do PUT
    const idx = this.reps.findIndex(x => x.id === this.editing!.id);
    const prev = idx >= 0 ? { ...this.reps[idx] } : null;
    if (idx >= 0) {
      this.reps[idx] = {
        ...this.reps[idx],
        name: this.editing.name,
        citizenID: this.editing.citizenID,
        nationality: this.editing.nationality,
        email: this.editing.email,
        phoneNumber: this.editing.phoneNumber,
        isActive: this.editing.isActive
      } as RepresentativeDTO;
      this.applyFilterSort();
      try { this.cdr.detectChanges(); } catch {}
    }

    try {
      const updated = await this.svc.update(tax, this.editing.id, {
        name: this.editing.name,
        citizenID: this.editing.citizenID,
        nationality: this.editing.nationality,
        email: this.editing.email,
        phoneNumber: this.editing.phoneNumber,
        isActive: this.editing.isActive
      });
      if (idx >= 0) this.reps[idx] = updated;
      this.applyFilterSort();
      this.closeEdit();
      try { this.cdr.detectChanges(); } catch {}
      this.toast.success(this.i18n.t('reps.toasts.updated'));
    } catch (e: any) {
      // rollback
      if (idx >= 0 && prev) this.reps[idx] = prev;
      this.applyFilterSort();
      try { this.cdr.detectChanges(); } catch {}
      this.error = e?.message || 'Erro ao atualizar representante';
    }
  }

  async deactivate(r: RepresentativeDTO) {
    if (!this.taxNumber) return;
    if (!confirm('Desativar este representante?')) return;
    this.error = null;
    const idx = this.reps.findIndex(x => x.id === r.id);
    const prev = r.isActive;
    if (idx >= 0) this.reps[idx].isActive = false; // otimista
    this.applyFilterSort();
    try { this.cdr.detectChanges(); } catch {}
    try {
      await this.svc.deactivate(this.taxNumber, r.id);
      this.toast.success(this.i18n.t('reps.toasts.deactivated'));
    } catch (e: any) {
      // rollback visual
      if (idx >= 0) this.reps[idx].isActive = prev;
      this.applyFilterSort();
      try { this.cdr.detectChanges(); } catch {}
      this.error = e?.message || 'Erro ao desativar representante';
    }
  }

  async remove(r: RepresentativeDTO) {
    if (!this.taxNumber) return;
    if (!confirm('Eliminar este representante?')) return;
    this.error = null;
    try {
      await this.svc.delete(this.taxNumber, r.id);
      this.reps = this.reps.filter(x => x.id !== r.id);
      this.applyFilterSort();
      try { this.cdr.detectChanges(); } catch {}
      this.toast.success(this.i18n.t('reps.toasts.deleted'));
    } catch (e: any) { this.error = e?.message || 'Erro ao eliminar representante'; }
  }
}

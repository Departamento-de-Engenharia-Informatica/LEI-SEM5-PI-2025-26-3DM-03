import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/i18n/translate.mock.module';
import { ResourcesService } from '../../services/resources/resources.service';
import { ResourceDTO, CreateResourceDTO, UpdateResourceDTO } from '../../models/resource';

type SortKey = 'code' | 'description' | 'type' | 'status' | 'operationalCapacity';

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './resources.component.html',
  styleUrls: ['./resources.component.scss']
})
export class ResourcesComponent implements OnInit {
  resources: ResourceDTO[] = [];
  filtered: ResourceDTO[] = [];
  loading = false;
  error: string | null = null;

  q = '';
  sortKey: SortKey = 'code';
  sortDir: 'asc' | 'desc' = 'asc';

  // Form state following vessels pattern
  showForm = false;
  isEditing = false;
  formError: string | null = null;
  successMessage: string | null = null;
  currentResource: any = {};

  // UI flags to prevent double submissions
  creating = false;
  saving = false;
  // per-resource operation tracking so multiple removes/reactivations can run
  removingCodes: Set<string> = new Set();
  deactivatingCodes: Set<string> = new Set();
  reactivatingCodes: Set<string> = new Set();

  constructor(private svc: ResourcesService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() { await this.load(); }

  async load() {
    this.loading = true; this.error = null;
    try {
      this.resources = await this.svc.getAll();
      this.applyFilterSort();
    } catch (e: any) {
      this.error = e?.message || 'Erro ao carregar recursos';
    } finally {
      this.loading = false;
      // ensure the view leaves the loading state immediately
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  applyFilterSort() {
    const q = this.q.trim().toLowerCase();
    let arr = this.resources.slice();
    if (q) {
      arr = arr.filter(r =>
        (r.code ?? '').toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.type ?? '').toLowerCase().includes(q)
      );
    }
  // Do not hide inactive resources here — show all resources and mark inactive ones in the UI
    const dir = this.sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = (a[this.sortKey] as any) ?? '';
      const vb = (b[this.sortKey] as any) ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    this.filtered = arr;
    // ensure UI updates immediately when data changes
    try { this.cdr.detectChanges(); } catch {}
  }

  // Normalise status checks: treat 'OPERATIONAL' and 'ACTIVE' as active states
  isActiveStatus(status?: string | null) {
    const s = (status ?? '').toString().trim().toUpperCase();
    return s === 'OPERATIONAL' || s === 'ACTIVE';
  }

  changeSort(k: SortKey) {
    if (this.sortKey === k) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortKey = k; this.sortDir = 'asc'; }
    this.applyFilterSort();
  }

  // show create form
  newResourceForm() {
    this.currentResource = { code: '', description: '', type: 'Generic', operationalCapacity: 1, assignedArea: null, setupTimeMinutes: null, status: 'OPERATIONAL' };
    this.formError = null;
    this.isEditing = false;
    this.showForm = true;
  }

  // Use a tiny deferred wrapper to make clicks more reliable in some browsers/layouts
  onCreateClick() {
    if (this.creating) return;
    // defer to next macrotask so that focus/blur events don't interfere
    setTimeout(() => this.newResourceForm(), 0);
  }


  editResource(r: ResourceDTO) {
    this.currentResource = { ...(r || {}) };
    this.isEditing = true;
    this.formError = null;
    this.showForm = true;
  }

  cancel() {
    this.currentResource = {};
    this.showForm = false;
    this.formError = null;
  }

  // Save handler used by the form (create or update)
  async save() {
    this.formError = null;
    const code = (this.currentResource.code ?? '').toString().trim();
    const description = (this.currentResource.description ?? '').toString().trim();
    const operationalCapacity = Number(this.currentResource.operationalCapacity ?? 0);

    // Basic validations
    if (!code) { this.formError = 'Code is required.'; return; }
    if (!description) { this.formError = 'Description is required.'; return; }
    if (!operationalCapacity || operationalCapacity <= 0) { this.formError = 'Capacity must be greater than zero.'; return; }

    try {
      if (this.isEditing) {
        const dto: UpdateResourceDTO = { description, operationalCapacity, assignedArea: this.currentResource.assignedArea, setupTimeMinutes: this.currentResource.setupTimeMinutes };
        await this.svc.update(code, dto);
        this.successMessage = 'Resource updated successfully.';
      } else {
        const payload: CreateResourceDTO = { code, description, type: this.currentResource.type ?? 'Generic', operationalCapacity };
        const created = await this.svc.create(payload);
        this.resources.unshift(created);
        this.successMessage = 'Resource created successfully.';
      }

  // refresh and close form
  await this.load();
  this.showForm = false;
  try { this.cdr.detectChanges(); } catch {}

      setTimeout(() => { this.successMessage = null; this.cdr.detectChanges(); }, 3000);

    } catch (err: any) {
      this.formError = err?.message ?? 'Save failed';
    }
  }

  // Wrapper for save click to improve reliability
  onSaveClick() {
    if (this.saving) return;
    setTimeout(() => this.save(), 0);
  }

  async deactivate(code: string) {
    if (!confirm('Desativar este recurso?')) return;
    if (this.deactivatingCodes.has(code)) return;
    this.deactivatingCodes.add(code);
    try {
      await this.svc.deactivate(code);
      // reload from backend to guarantee latest state and refresh bindings
      await this.load();
      try { this.cdr.detectChanges(); } catch {}
    } catch (e: any) { this.error = e?.message || 'Erro ao desativar recurso'; }
    finally { this.deactivatingCodes.delete(code); }
  }



  // Remove resource (uses deactivate endpoint as fallback)
  async remove(r: ResourceDTO) {
    const code = r.code;
    if (!code) return;
    if (this.removingCodes.has(code)) return;
    if (!confirm(`Remove resource ${code}?`)) return;
    this.removingCodes.add(code);
    // Optimistic UI: remove locally immediately and restore on non-404 error
    const idx = this.resources.findIndex(x => x.code === code);
    let backup: ResourceDTO | null = null;
      if (idx >= 0) {
      backup = this.resources[idx];
      this.resources.splice(idx, 1);
      this.applyFilterSort();
      try { this.cdr.detectChanges(); } catch {}
    }
    try {
      await this.svc.deactivate(code);
    } catch (e: any) {
      const msg = e?.message ?? '';
      // If 404 (already removed) treat as success, otherwise restore and show error
      if (typeof msg === 'string' && msg.includes('404')) {
        // nothing to do
      } else {
        if (backup) {
          this.resources.splice(idx >= 0 ? idx : 0, 0, backup);
          this.applyFilterSort();
          try { this.cdr.detectChanges(); } catch {}
        }
        this.error = msg || 'Erro ao remover recurso';
      }
    } finally {
      this.removingCodes.delete(code);
    }
  }

  // Reactivate a previously deactivated resource
  async reactivate(code: string) {
    if (this.reactivatingCodes.has(code)) return;
    if (!confirm('Reactivar este recurso?')) return;
    this.reactivatingCodes.add(code);
    try {
      await this.svc.activate(code);
      // reload from backend to guarantee latest state and refresh bindings
      await this.load();
      try { this.cdr.detectChanges(); } catch {}
    } catch (e: any) { this.error = e?.message || 'Erro ao reativar recurso'; }
    finally { this.reactivatingCodes.delete(code); }
  }
}

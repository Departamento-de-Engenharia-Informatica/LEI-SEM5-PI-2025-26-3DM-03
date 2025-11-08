import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResourcesService } from '../../services/resources/resources.service';
import { ResourceDTO, CreateResourceDTO, UpdateResourceDTO } from '../../models/resource';

type SortKey = 'code' | 'description' | 'type' | 'status' | 'operationalCapacity';

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  newResource: CreateResourceDTO = { code: '', description: '', type: 'Generic', operationalCapacity: 1 };

  editing: (UpdateResourceDTO & { code: string }) | null = null;

  constructor(private svc: ResourcesService) {}

  async ngOnInit() { await this.load(); }

  async load() {
    this.loading = true; this.error = null;
    try {
      this.resources = await this.svc.getAll();
      this.applyFilterSort();
    } catch (e: any) {
      this.error = e?.message || 'Erro ao carregar recursos';
    } finally { this.loading = false; }
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
    const dir = this.sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = (a[this.sortKey] as any) ?? '';
      const vb = (b[this.sortKey] as any) ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
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
    this.error = null;
    try {
      const created = await this.svc.create(this.newResource);
      this.resources.unshift(created);
      this.applyFilterSort();
      this.newResource = { code: '', description: '', type: 'Generic', operationalCapacity: 1 };
    } catch (e: any) { this.error = e?.message || 'Erro ao criar recurso'; }
  }

  openEdit(r: ResourceDTO) {
    this.editing = { code: r.code, description: r.description ?? '', operationalCapacity: r.operationalCapacity ?? 1, assignedArea: r.assignedArea ?? null, setupTimeMinutes: r.setupTimeMinutes ?? null };
  }

  closeEdit() { this.editing = null; }

  async saveEdit() {
    if (!this.editing) return;
    this.error = null;
    try {
      const dto: UpdateResourceDTO = { description: this.editing.description, operationalCapacity: this.editing.operationalCapacity, assignedArea: this.editing.assignedArea, setupTimeMinutes: this.editing.setupTimeMinutes };
      await this.svc.update(this.editing.code, dto);
      const idx = this.resources.findIndex(r => r.code === this.editing!.code);
      if (idx >= 0) {
        this.resources[idx] = { ...this.resources[idx], ...dto } as ResourceDTO;
      }
      this.applyFilterSort();
      this.closeEdit();
    } catch (e: any) { this.error = e?.message || 'Erro ao atualizar recurso'; }
  }

  async deactivate(code: string) {
    if (!confirm('Desativar este recurso?')) return;
    try {
      await this.svc.deactivate(code);
      const idx = this.resources.findIndex(r => r.code === code);
      if (idx >= 0) this.resources[idx].status = 'Inactive';
      this.applyFilterSort();
    } catch (e: any) { this.error = e?.message || 'Erro ao desativar recurso'; }
  }
}

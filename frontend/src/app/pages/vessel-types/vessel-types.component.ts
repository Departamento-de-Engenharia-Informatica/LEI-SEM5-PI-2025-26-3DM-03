import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VesselTypesService } from '../../services/vessel-types/vessel-types.service';
import { CreateVesselTypeDTO, UpdateVesselTypeDTO, VesselTypeDTO } from '../../models/vessel-type';
import { ToastService } from '../../components/toast/toast.service';

@Component({
  selector: 'app-vessel-types',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vessel-types.component.html',
  styleUrls: ['./vessel-types.component.scss']
})
export class VesselTypesComponent implements OnInit {
  // State
  loading = false;
  error: string | null = null;

  // Data
  items: VesselTypeDTO[] = [];
  filtered: VesselTypeDTO[] = [];

  // Filter/sort
  q = '';
  sortKey: 'name' | 'capacity' | 'maxRows' | 'maxBays' | 'maxTiers' = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  // Create/Edit
  newType: CreateVesselTypeDTO = { name: '', description: '', capacity: 0, operationalConstraints: { maxRows: 0, maxBays: 0, maxTiers: 0 } };
  editing: (UpdateVesselTypeDTO & { id: number }) | null = null;

  constructor(private svc: VesselTypesService, private cdr: ChangeDetectorRef, private toast: ToastService) {}

  async ngOnInit() { await this.load(); }

  async load() {
    this.loading = true; this.error = null;
    try {
      this.items = await this.svc.getAll();
      this.applyFilterSort();
    } catch (e: any) {
      this.error = e?.message || 'Falha ao carregar tipos de navio.';
    } finally { this.loading = false; try { this.cdr.detectChanges(); } catch {} }
  }

  applyFilterSort() {
    const q = (this.q || '').trim().toLowerCase();
    let arr = this.items.slice();
    if (q) {
      arr = arr.filter(t => (t.name || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const get = (t: VesselTypeDTO) => {
      if (this.sortKey === 'capacity') return t.capacity || 0;
      if (this.sortKey === 'maxRows') return t.operationalConstraints?.maxRows || 0;
      if (this.sortKey === 'maxBays') return t.operationalConstraints?.maxBays || 0;
      if (this.sortKey === 'maxTiers') return t.operationalConstraints?.maxTiers || 0;
      return (t.name || '').toLowerCase();
    };
    arr.sort((a, b) => {
      const va = get(a); const vb = get(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    this.filtered = arr;
  }

  changeSort(k: 'name' | 'capacity' | 'maxRows' | 'maxBays' | 'maxTiers') {
    if (this.sortKey === k) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortKey = k; this.sortDir = 'asc'; }
    this.applyFilterSort();
  }

  clearFilter() { this.q = ''; this.applyFilterSort(); }

  async create() {
    const name = (this.newType.name || '').trim();
    if (!name) { this.error = 'Nome é obrigatório.'; return; }
    try {
      const dto: CreateVesselTypeDTO = {
        name,
        description: (this.newType.description || '').trim(),
        capacity: Number(this.newType.capacity) || 0,
        operationalConstraints: {
          maxRows: Number(this.newType.operationalConstraints?.maxRows || 0),
          maxBays: Number(this.newType.operationalConstraints?.maxBays || 0),
          maxTiers: Number(this.newType.operationalConstraints?.maxTiers || 0)
        }
      };
      const created = await this.svc.create(dto);
      this.items.unshift(created);
      this.applyFilterSort();
      this.newType = { name: '', description: '', capacity: 0, operationalConstraints: { maxRows: 0, maxBays: 0, maxTiers: 0 } };
      this.toast.success('Vessel type criado');
    } catch (e: any) { this.error = e?.message || 'Falha ao criar tipo de navio.'; }
  }

  openEdit(t: VesselTypeDTO) {
    this.editing = {
      id: t.id,
      name: t.name,
      description: t.description,
      capacity: t.capacity,
      operationalConstraints: { ...t.operationalConstraints }
    };
  }
  closeEdit() { this.editing = null; }

  async saveEdit() {
    if (!this.editing) { this.error = 'Sem dados para guardar.'; return; }
    const t = this.editing;
    try {
      const dto: UpdateVesselTypeDTO = {
        id: t.id,
        name: (t.name || '').trim(),
        description: (t.description || '').trim(),
        capacity: Number(t.capacity) || 0,
        operationalConstraints: {
          maxRows: Number(t.operationalConstraints?.maxRows || 0),
          maxBays: Number(t.operationalConstraints?.maxBays || 0),
          maxTiers: Number(t.operationalConstraints?.maxTiers || 0)
        }
      };
      await this.svc.update(t.id, dto);
      const idx = this.items.findIndex(x => x.id === t.id);
      if (idx >= 0) this.items[idx] = { id: t.id, name: dto.name, description: dto.description, capacity: dto.capacity, operationalConstraints: dto.operationalConstraints } as VesselTypeDTO;
      this.applyFilterSort();
      this.toast.success('Alterações guardadas');
      this.closeEdit();
    } catch (e: any) { this.error = e?.message || 'Falha ao guardar.'; }
  }

  async remove(id: number) {
    if (!confirm('Eliminar este tipo de navio?')) return;
    try {
      await this.svc.delete(id);
      this.items = this.items.filter(x => x.id !== id);
      this.applyFilterSort();
      this.toast.success('Eliminado');
    } catch (e: any) { this.error = e?.message || 'Falha ao eliminar.'; }
  }
}

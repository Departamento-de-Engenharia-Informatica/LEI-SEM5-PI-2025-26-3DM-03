import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageAreasService } from '../../services/storage-areas/storage-areas.service';
import { StorageAreaDTO, CreateStorageAreaDTO, UpdateStorageAreaDTO } from '../../models/storage-area';

type SortKey = 'location' | 'type' | 'maxCapacityTEU' | 'currentOccupancyTEU';

@Component({
  selector: 'app-storage-areas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './storage-areas.component.html',
  styleUrls: ['./storage-areas.component.scss']
})
export class StorageAreasComponent implements OnInit {
  areas: StorageAreaDTO[] = [];
  filtered: StorageAreaDTO[] = [];
  loading = false;
  error: string | null = null;

  // pesquisa e ordenação
  q = '';
  sortKey: SortKey = 'location';
  sortDir: 'asc' | 'desc' = 'asc';

  // criação
  newArea: CreateStorageAreaDTO = {
    type: 'Yard',
    location: '',
    maxCapacityTEU: 0,
    currentOccupancyTEU: 0
  };

  // edição
  editing: UpdateStorageAreaDTO | null = null;

  constructor(private svc: StorageAreasService) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading = true;
    this.error = null;
    try {
      this.areas = await this.svc.getAll();
      this.applyFilterSort();
    } catch (e: any) {
      this.error = e?.message || 'Erro ao carregar áreas de armazenamento';
    } finally {
      this.loading = false;
    }
  }

  // === UI ===
  applyFilterSort() {
    const q = this.q.trim().toLowerCase();
    let arr = this.areas.slice();

    if (q) {
      arr = arr.filter(a =>
        (a.location ?? '').toLowerCase().includes(q) ||
        (a.type ?? '').toLowerCase().includes(q)
      );
    }

    const dir = this.sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = (a[this.sortKey] as any) ?? '';
      const vb = (b[this.sortKey] as any) ?? '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });

    this.filtered = arr;
  }

  changeSort(key: SortKey) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.applyFilterSort();
  }

  // === CRUD ===
  async create() {
    this.error = null;
    try {
      const created = await this.svc.create(this.newArea);
      this.areas.unshift(created);
      this.applyFilterSort();
      this.newArea = { type: 'Yard', location: '', maxCapacityTEU: 0, currentOccupancyTEU: 0 };
    } catch (e: any) {
      this.error = e?.message || 'Erro ao criar área';
    }
  }

  openEdit(area: StorageAreaDTO) {
    this.editing = {
      id: area.id,
      type: area.type ?? 'Yard',
      location: area.location ?? '',
      maxCapacityTEU: area.maxCapacityTEU ?? 0,
      currentOccupancyTEU: area.currentOccupancyTEU ?? 0
    };
  }

  closeEdit() { this.editing = null; }

  async saveEdit() {
    if (!this.editing) return;
    this.error = null;
    try {
      const updated = await this.svc.update(this.editing.id, this.editing);
      const idx = this.areas.findIndex(a => a.id === updated.id);
      if (idx >= 0) this.areas[idx] = updated;
      this.applyFilterSort();
      this.closeEdit();
    } catch (e: any) {
      this.error = e?.message || 'Erro ao atualizar área';
    }
  }

  async delete(id: number) {
    if (!confirm('Eliminar esta área de armazenamento?')) return;
    try {
      await this.svc.delete(id);
      this.areas = this.areas.filter(a => a.id !== id);
      this.applyFilterSort();
    } catch (e: any) {
      this.error = e?.message || 'Erro ao eliminar área';
    }
  }
}

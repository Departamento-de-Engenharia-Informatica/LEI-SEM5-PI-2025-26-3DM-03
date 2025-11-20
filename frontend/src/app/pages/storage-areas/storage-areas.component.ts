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

  readonly integerFormatter = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });
  readonly percentFormatter = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });

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

  get summaryMetrics() {
    const visible = this.filtered.length;
    const total = this.areas.length;

    const capacityValues = this.filtered
      .map((area) => this.asNumber(area.maxCapacityTEU))
      .filter((val): val is number => val !== null);
    const occupancyValues = this.filtered
      .map((area) => this.asNumber(area.currentOccupancyTEU))
      .filter((val): val is number => val !== null);

    const totalCapacity = capacityValues.reduce((acc, val) => acc + val, 0);
    const totalOccupancy = occupancyValues.reduce((acc, val) => acc + val, 0);
    const hasCapacity = capacityValues.length > 0;
    const usage = totalCapacity > 0 ? (totalOccupancy / totalCapacity) * 100 : null;
    const available = hasCapacity ? Math.max(totalCapacity - totalOccupancy, 0) : null;

    const typeSet = new Set(
      this.filtered
        .map((area) => area.type)
        .filter((type): type is string => !!type)
    );

    return [
      {
        icon: '📦',
        label: 'Áreas visíveis',
        value: this.integerFormatter.format(visible),
        hint: total === visible ? 'Todas as áreas listadas' : `${this.integerFormatter.format(total)} no total`
      },
      {
        icon: '🏗',
        label: 'Capacidade disponível',
        value: hasCapacity ? `${this.integerFormatter.format(totalCapacity)} TEU` : '—',
        hint: hasCapacity ? `${this.integerFormatter.format(available ?? 0)} TEU livres` : 'Sem capacidade registada'
      },
      {
        icon: '📊',
        label: 'Ocupação média',
        value: usage !== null ? `${this.percentFormatter.format(usage)}%` : '—',
        hint: typeSet.size ? `${typeSet.size} tipos diferentes` : 'Sem tipos definidos',
        highlight: usage !== null && usage >= 75
      }
    ];
  }

  getOccupancyPercent(area: StorageAreaDTO): number | null {
    const capacity = this.asNumber(area.maxCapacityTEU);
    const occupancy = this.asNumber(area.currentOccupancyTEU);
    if (capacity === null || capacity <= 0 || occupancy === null) {
      return null;
    }
    return Math.min(100, Math.max(0, (occupancy / capacity) * 100));
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

  private asNumber(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}

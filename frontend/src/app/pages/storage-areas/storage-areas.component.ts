import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageAreasService } from '../../services/storage-areas/storage-areas.service';
import { StorageAreaDTO, CreateStorageAreaDTO, UpdateStorageAreaDTO } from '../../models/storage-area';
import { TranslationService } from '../../services/i18n/translation.service';
import { DocksService } from '../../services/docks/docks.service';
import { DockDTO } from '../../models/dock';

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
  availableDocks: DockDTO[] = [];
  private dockLookup = new Map<number, DockDTO>();

  // pesquisa e ordenação
  q = '';
  sortKey: SortKey = 'location';
  sortDir: 'asc' | 'desc' = 'asc';

  // criação
  newArea: CreateStorageAreaDTO = {
    type: 'Yard',
    location: '',
    maxCapacityTEU: 0,
    currentOccupancyTEU: 0,
    servedDockIds: []
  };

  // edição
  editing: UpdateStorageAreaDTO | null = null;

  private get locale(): string {
    return this.i18n.getLang() === 'pt' ? 'pt-PT' : 'en-US';
  }

  get integerFormatter(): Intl.NumberFormat {
    return new Intl.NumberFormat(this.locale, { maximumFractionDigits: 0 });
  }

  get percentFormatter(): Intl.NumberFormat {
    return new Intl.NumberFormat(this.locale, { maximumFractionDigits: 0 });
  }

  constructor(
    private svc: StorageAreasService,
    private docksService: DocksService,
    public i18n: TranslationService
  ) {}

  async ngOnInit() {
    await Promise.all([this.load(), this.loadDocks()]);
  }

  async load() {
    this.loading = true;
    this.error = null;
    try {
      this.areas = await this.svc.getAll();
      this.applyFilterSort();
    } catch (e: any) {
        this.error = e?.message || this.i18n.t('storageAreas.errors.load');
    } finally {
      this.loading = false;
    }
  }

  private async loadDocks() {
    try {
      const docks = await this.docksService.getAll();
      this.availableDocks = docks;
      this.dockLookup.clear();
      docks.forEach((dock) => this.dockLookup.set(dock.id, dock));
    } catch (err) {
      console.warn('[StorageAreas] Failed to load docks for association', err);
      this.availableDocks = [];
      this.dockLookup.clear();
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
        label: this.i18n.t('storageAreas.summary.visibleLabel'),
        value: this.integerFormatter.format(visible),
        hint:
          total === visible
            ? this.i18n.t('storageAreas.summary.visibleHintAll')
            : this.format('storageAreas.summary.visibleHintPartial', {
                visible: this.integerFormatter.format(visible),
                total: this.integerFormatter.format(total)
              })
      },
      {
        icon: '🏗',
        label: this.i18n.t('storageAreas.summary.capacityLabel'),
        value: hasCapacity ? `${this.integerFormatter.format(totalCapacity)} TEU` : '—',
        hint: hasCapacity
          ? this.format('storageAreas.summary.capacityHint', {
              available: this.integerFormatter.format(available ?? 0)
            })
          : this.i18n.t('storageAreas.summary.capacityNone')
      },
      {
        icon: '📊',
        label: this.i18n.t('storageAreas.summary.usageLabel'),
        value: usage !== null ? `${this.percentFormatter.format(usage)}%` : '—',
        hint: typeSet.size
          ? this.format('storageAreas.summary.usageHint', {
              types: this.integerFormatter.format(typeSet.size)
            })
          : this.i18n.t('storageAreas.summary.usageNone'),
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
      this.newArea = { type: 'Yard', location: '', maxCapacityTEU: 0, currentOccupancyTEU: 0, servedDockIds: [] };
    } catch (e: any) {
        this.error = e?.message || this.i18n.t('storageAreas.errors.create');
    }
  }

  openEdit(area: StorageAreaDTO) {
    this.editing = {
      id: area.id,
      type: area.type ?? 'Yard',
      location: area.location ?? '',
      maxCapacityTEU: area.maxCapacityTEU ?? 0,
      currentOccupancyTEU: area.currentOccupancyTEU ?? 0,
      servedDockIds: [...(area.servedDockIds ?? [])]
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
        this.error = e?.message || this.i18n.t('storageAreas.errors.update');
    }
  }

  shouldEnableDockSelection(model: { type?: string | null } | null): boolean {
    const type = model?.type ?? '';
    return type.toLowerCase() === 'warehouse';
  }

  onTypeChange(model: CreateStorageAreaDTO | UpdateStorageAreaDTO) {
    if (!this.shouldEnableDockSelection(model)) {
      model.servedDockIds = [];
    }
  }

  toggleDockSelection(
    model: CreateStorageAreaDTO | UpdateStorageAreaDTO,
    dockId: number,
    selected: boolean
  ) {
    if (!model.servedDockIds) {
      model.servedDockIds = [];
    }
    if (selected) {
      if (!model.servedDockIds.includes(dockId)) {
        model.servedDockIds = [...model.servedDockIds, dockId];
      }
    } else {
      model.servedDockIds = model.servedDockIds.filter((id) => id !== dockId);
    }
  }

  getDockNames(area: { servedDockIds?: number[] | null }): string[] {
    const ids = area.servedDockIds ?? [];
    if (!ids.length || !this.dockLookup.size) return [];
    return ids
      .map((id) => this.dockLookup.get(id)?.name || `Dock ${id}`)
      .filter((name): name is string => !!name);
  }

  async delete(id: number) {
    if (!confirm(this.i18n.t('storageAreas.confirm.delete'))) return;
    try {
      await this.svc.delete(id);
      this.areas = this.areas.filter(a => a.id !== id);
      this.applyFilterSort();
    } catch (e: any) {
        this.error = e?.message || this.i18n.t('storageAreas.errors.delete');
    }
  }

  private asNumber(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private format(key: string, replacements: Record<string, string>): string {
    let template = this.i18n.t(key);
    for (const [token, value] of Object.entries(replacements)) {
      template = template.replace(new RegExp(`{${token}}`, 'g'), value);
    }
    return template;
  }
}

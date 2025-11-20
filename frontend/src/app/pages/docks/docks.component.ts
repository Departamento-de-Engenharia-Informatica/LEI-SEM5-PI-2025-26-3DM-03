import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/i18n/translate.mock.module';
import { DocksService } from '../../services/docks/docks.service';
import { ToastService } from '../../components/toast/toast.service';
import { CreateDockDTO, DockDTO, UpdateDockDTO } from '../../models/dock';

type SortKey = 'name' | 'location' | 'length' | 'depth' | 'maxDraft';

@Component({
  selector: 'app-docks',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './docks.component.html',
  styleUrls: ['./docks.component.scss']
})
export class DocksComponent implements OnInit, OnDestroy {
  docks: DockDTO[] = [];
  filtered: DockDTO[] = [];

  // pesquisa & ordenação
  q = '';
  sortKey: SortKey = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  // criação
  newDock: CreateDockDTO = {
    name: '',
    location: '',
    length: 0,
    depth: 0,
    maxDraft: 0
  };

  // modal edição
  editing: UpdateDockDTO | null = null;

  // estado
  loading = false;
  error: string | null = null;
  saving = false;

  private readonly integerFormatter = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });
  private readonly decimalFormatter = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  private _sub: any;
  constructor(private docksService: DocksService, private cdr: ChangeDetectorRef, private toast: ToastService) {}

  async ngOnInit() {
    // Subscribe to cached + live updates from service
    this._sub = this.docksService.docks$.subscribe(list => {
      if (list && Array.isArray(list)) {
        this.docks = list;
        this.applyFilterSort();
      }
      // hide skeleton if we have any data
      if (this.docks.length) this.loading = false;
      try { this.cdr.detectChanges(); } catch {}
    });

    // Trigger a network refresh (non-blocking) and handle errors
    this.loading = this.docks.length === 0;
    this.error = null;
    this.docksService.getAll().catch((err: any) => { this.error = err?.message || 'Erro ao carregar docks'; this.loading = false; try { this.cdr.detectChanges(); } catch {} });
  }

  ngOnDestroy(): void {
    try { this._sub?.unsubscribe?.(); } catch {}
  }

  async loadDocks() {
    this.loading = true;
    this.error = null;
    try {
      this.docks = await this.docksService.getAll();
      this.applyFilterSort();
    } catch (err: any) {
      this.error = err?.message || 'Erro ao carregar docks';
    } finally {
      this.loading = false;
    }
  }

  // ---- UI helpers ----
  applyFilterSort() {
    const q = this.q.trim().toLowerCase();
    let arr = this.docks.slice();

    if (q) {
      arr = arr.filter(d =>
        (d.name ?? '').toLowerCase().includes(q) ||
        (d.location ?? '').toLowerCase().includes(q)
      );
    }

    arr.sort((a, b) => {
      const dir = this.sortDir === 'asc' ? 1 : -1;
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
    const total = this.docks.length;

    const lengthValues = this.filtered
      .map(d => this.asNumber(d.length))
      .filter((v): v is number => v !== null);
    const depthValues = this.filtered
      .map(d => this.asNumber(d.depth))
      .filter((v): v is number => v !== null);
    const draftValues = this.filtered
      .map(d => this.asNumber(d.maxDraft))
      .filter((v): v is number => v !== null);

    const totalLength = lengthValues.reduce((acc, val) => acc + val, 0);
    const avgDepth = depthValues.length ? depthValues.reduce((acc, val) => acc + val, 0) / depthValues.length : null;
    const peakDraft = draftValues.length ? Math.max(...draftValues) : null;

    return [
      {
        icon: '🗂',
        label: 'Docas visíveis',
        value: this.integerFormatter.format(visible),
        hint: total === visible ? 'Todas as docas listadas' : `${this.integerFormatter.format(total)} no total`
      },
      {
        icon: '📏',
        label: 'Comprimento combinado',
        value: totalLength ? `${this.integerFormatter.format(totalLength)} m` : '—',
        hint: lengthValues.length ? `${lengthValues.length} com comprimento definido` : 'Sem valores de comprimento'
      },
      {
        icon: '🌊',
        label: 'Profundidade média',
        value: avgDepth !== null ? `${this.decimalFormatter.format(avgDepth)} m` : '—',
        hint: draftValues.length ? `Max draft visível: ${this.integerFormatter.format(peakDraft ?? 0)} m` : 'Sem valores registados',
        highlight: draftValues.length > 0
      }
    ];
  }

  // ---- CRUD ----
  async createDock() {
    this.error = null;
    try {
      const dto = { ...this.newDock };
      await this.docksService.create(dto);
      // service updates the subject/cache; subscription will refresh view
      this.newDock = { name: '', location: '', length: 0, depth: 0, maxDraft: 0 };
      try { this.toast.success('Dock criado'); } catch {}
    } catch (err: any) {
      this.error = err?.message || 'Erro ao criar dock';
      try { this.toast.error(this.error ?? 'Erro ao criar dock'); } catch {}
    }
  }

  openEdit(dock: DockDTO) {
    this.editing = {
      id: dock.id,
      name: dock.name,
      location: dock.location,
      length: dock.length,
      depth: dock.depth,
      maxDraft: dock.maxDraft
    };
  }

  closeEdit() {
    this.editing = null;
  }

  async saveEdit() {
    if (!this.editing) return;
    this.error = null;
    this.saving = true;
    try { this.cdr.detectChanges(); } catch {}
    // Optimistic update: apply edits locally immediately for snappier UX,
    // then send PUT. Rollback on error.
    const idx = this.docks.findIndex(x => x.id === this.editing!.id);
    const prev = idx >= 0 ? { ...this.docks[idx] } : null;
    if (idx >= 0) {
      this.docks[idx] = {
        ...this.docks[idx],
        name: this.editing!.name,
        location: this.editing!.location,
        length: this.editing!.length,
        depth: this.editing!.depth,
        maxDraft: this.editing!.maxDraft
      } as DockDTO;
      this.applyFilterSort();
      try { this.cdr.detectChanges(); } catch {}
    }

    try {
      console.log('[DocksComponent] saveEdit called, payload:', this.editing);
      await this.docksService.update(this.editing.id, this.editing);
      console.log('[DocksComponent] update completed for id', this.editing.id);
      // service will refresh the cache/subject; our optimistic update already showed the change
      this.closeEdit();
      try { this.toast.success('Dock atualizado'); } catch {}
    } catch (err: any) {
      // rollback
      if (idx >= 0 && prev) this.docks[idx] = prev;
      this.applyFilterSort();
      try { this.cdr.detectChanges(); } catch {}
      this.error = err?.message || 'Erro ao atualizar dock';
      try { this.toast.error(this.error ?? 'Erro ao atualizar dock'); } catch {}
    }
    finally {
      this.saving = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  async deleteDock(id: number) {
    if (!confirm('Eliminar esta dock?')) return;
    try {
      await this.docksService.delete(id);
      // service updated cache/subject which will update UI
      try { this.toast.success('Dock eliminado'); } catch {}
    } catch (err: any) {
      this.error = err?.message || 'Erro ao eliminar dock';
      try { this.toast.error(this.error ?? 'Erro ao eliminar dock'); } catch {}
    }
  }

  private asNumber(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}

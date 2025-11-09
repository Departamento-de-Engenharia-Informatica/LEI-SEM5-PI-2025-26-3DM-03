import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/i18n/translate.mock.module';
import { DocksService } from '../../services/docks/docks.service';
import { CreateDockDTO, DockDTO, UpdateDockDTO } from '../../models/dock';

type SortKey = 'name' | 'location' | 'length' | 'depth' | 'maxDraft';

@Component({
  selector: 'app-docks',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './docks.component.html',
  styleUrls: ['./docks.component.scss']
})
export class DocksComponent implements OnInit {
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

  constructor(private docksService: DocksService) {}

  async ngOnInit() {
    await this.loadDocks();
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

  // ---- CRUD ----
  async createDock() {
    this.error = null;
    try {
      const dto = { ...this.newDock };
      const created = await this.docksService.create(dto);
      this.docks.unshift(created);
      this.applyFilterSort();
      this.newDock = { name: '', location: '', length: 0, depth: 0, maxDraft: 0 };
    } catch (err: any) {
      this.error = err?.message || 'Erro ao criar dock';
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
    try {
      await this.docksService.update(this.editing.id, this.editing);
      // reflectir localmente
      const idx = this.docks.findIndex(d => d.id === this.editing!.id);
      if (idx >= 0) this.docks[idx] = { ...this.docks[idx], ...this.editing };
      this.applyFilterSort();
      this.closeEdit();
    } catch (err: any) {
      this.error = err?.message || 'Erro ao atualizar dock';
    }
  }

  async deleteDock(id: number) {
    if (!confirm('Eliminar esta dock?')) return;
    try {
      await this.docksService.delete(id);
      this.docks = this.docks.filter(d => d.id !== id);
      this.applyFilterSort();
    } catch (err: any) {
      this.error = err?.message || 'Erro ao eliminar dock';
    }
  }
}

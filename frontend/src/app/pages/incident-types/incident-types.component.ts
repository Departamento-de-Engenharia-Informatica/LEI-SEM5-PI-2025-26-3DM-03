import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IncidentTypesService } from '../../services/incident-types/incident-types.service';
import {
  CreateIncidentTypeDTO,
  IncidentSeverity,
  IncidentTypeDTO,
  IncidentTypeFilters,
  IncidentTypeTreeDTO,
  UpdateIncidentTypeDTO,
} from '../../models/incident-type';
import { ToastService } from '../../components/toast/toast.service';

interface EditState {
  id: number;
  form: UpdateIncidentTypeDTO & { id: number };
}

@Component({
  selector: 'app-incident-types',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './incident-types.component.html',
  styleUrls: ['./incident-types.component.scss'],
})
export class IncidentTypesComponent implements OnInit {
  readonly severities = Object.values(IncidentSeverity);

  listLoading = false;
  treeLoading = false;
  listError: string | null = null;
  treeError: string | null = null;
  createError: string | null = null;
  editError: string | null = null;

  incidentTypes: IncidentTypeDTO[] = [];
  tree: IncidentTypeTreeDTO[] = [];
  private treeLoaded = false;

  filters: {
    q: string;
    severity: 'ALL' | IncidentSeverity;
    parentId: 'ALL' | number;
  } = {
    q: '',
    severity: 'ALL',
    parentId: 'ALL',
  };

  viewMode: 'flat' | 'tree' = 'flat';

  newIncident: CreateIncidentTypeDTO = this.buildCreateModel();
  editing: EditState | null = null;

  constructor(
    private readonly svc: IncidentTypesService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    await this.loadFlat();
    if (this.treeLoaded || this.viewMode === 'tree') {
      await this.loadTree();
    }
  }

  switchView(mode: 'flat' | 'tree'): void {
    this.viewMode = mode;
    if (mode === 'tree' && this.tree.length === 0 && !this.treeLoading) {
      void this.loadTree();
    }
  }

  applyFilters(): void {
    void this.loadFlat();
    if (this.viewMode === 'tree' || this.treeLoaded) {
      void this.loadTree();
    }
  }

  resetFilters(): void {
    this.filters = { q: '', severity: 'ALL', parentId: 'ALL' };
    this.applyFilters();
  }

  async loadFlat(): Promise<void> {
    this.listLoading = true;
    this.listError = null;
    try {
      const filters = this.buildFilters();
      this.incidentTypes = await this.svc.getAll(filters);
      if (this.editing) {
        const match = this.incidentTypes.find((it) => it.id === this.editing?.id);
        if (!match) {
          this.editing = null;
        }
      }
    } catch (err) {
      this.listError = this.readError(err) || 'Falha ao carregar tipos de incidente.';
    } finally {
      this.listLoading = false;
      try {
        this.cdr.detectChanges();
      } catch {}
    }
  }

  async loadTree(): Promise<void> {
    this.treeLoading = true;
    this.treeError = null;
    try {
      const filters = this.buildFilters();
      this.tree = await this.svc.getTree(filters);
      this.treeLoaded = true;
    } catch (err) {
      this.treeError = this.readError(err) || 'Falha ao carregar hierarquia.';
    } finally {
      this.treeLoading = false;
      try {
        this.cdr.detectChanges();
      } catch {}
    }
  }

  async create(): Promise<void> {
    const code = (this.newIncident.code || '').trim();
    const name = (this.newIncident.name || '').trim();
    if (!code || !name) {
      this.createError = 'Código e nome são obrigatórios.';
      return;
    }

    const payload: CreateIncidentTypeDTO = {
      code,
      name,
      severity: this.newIncident.severity,
      description: (this.newIncident.description || '').trim() || undefined,
      parentId: this.normalizeParent(this.newIncident.parentId),
    };

    this.createError = null;

    try {
      await this.svc.create(payload);
      this.toast.success('Tipo de incidente criado.');
      this.newIncident = this.buildCreateModel();
      await this.refresh();
    } catch (err) {
      this.createError = this.readError(err) || 'Falha ao criar tipo de incidente.';
      this.toast.error(this.createError);
    } finally {
      try {
        this.cdr.detectChanges();
      } catch {}
    }
  }

  startEdit(item: IncidentTypeDTO): void {
    this.editError = null;
    this.editing = {
      id: item.id,
      form: {
        id: item.id,
        code: item.code,
        name: item.name,
        description: item.description ?? undefined,
        severity: item.severity,
        parentId: item.parentId ?? undefined,
      },
    };
  }

  cancelEdit(): void {
    this.editing = null;
    this.editError = null;
  }

  async saveEdit(): Promise<void> {
    if (!this.editing) {
      return;
    }

    const { form, id } = this.editing;
    const code = (form.code || '').trim();
    const name = (form.name || '').trim();
    if (!code || !name) {
      this.editError = 'Código e nome são obrigatórios.';
      return;
    }

    const payload: UpdateIncidentTypeDTO = {
      code,
      name,
      severity: form.severity,
      description: (form.description || '').trim() || undefined,
      parentId: this.normalizeParent(form.parentId),
    };

    this.editError = null;

    try {
      await this.svc.update(id, payload);
      this.toast.success('Tipo de incidente atualizado.');
      this.editing = null;
      await this.refresh();
    } catch (err) {
      this.editError = this.readError(err) || 'Falha ao atualizar tipo de incidente.';
      this.toast.error(this.editError);
    } finally {
      try {
        this.cdr.detectChanges();
      } catch {}
    }
  }

  async remove(item: IncidentTypeDTO): Promise<void> {
    if (!confirm(`Remover "${item.name}"? Esta ação é irreversível.`)) {
      return;
    }
    try {
      await this.svc.delete(item.id);
      this.toast.success('Tipo de incidente removido.');
      await this.refresh();
    } catch (err) {
      const msg = this.readError(err) || 'Falha ao remover tipo de incidente.';
      this.toast.error(msg);
    }
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  trackTree(_: number, node: IncidentTypeTreeDTO): number {
    return node.id;
  }

  parentLabel(parentId?: number | null): string {
    if (!parentId) {
      return '—';
    }
    const parent = this.incidentTypes.find((it) => it.id === parentId);
    return parent ? `${parent.code} · ${parent.name}` : `ID ${parentId}`;
  }

  availableParents(currentId?: number): IncidentTypeDTO[] {
    return this.incidentTypes.filter((it) => it.id !== currentId);
  }

  private buildFilters(): IncidentTypeFilters {
    const filters: IncidentTypeFilters = {};
    const trimmed = this.filters.q.trim();
    if (trimmed) {
      filters.q = trimmed;
    }
    if (this.filters.severity !== 'ALL') {
      filters.severity = this.filters.severity;
    }
    if (this.filters.parentId !== 'ALL') {
      const value = Number(this.filters.parentId);
      if (Number.isFinite(value) && value > 0) {
        filters.parentId = value;
      }
    }
    return filters;
  }

  private buildCreateModel(): CreateIncidentTypeDTO {
    return {
      code: '',
      name: '',
      severity: IncidentSeverity.MINOR,
      description: '',
      parentId: undefined,
    };
  }

  private normalizeParent(value: number | null | undefined): number | null {
    if (value === null || value === undefined || value === ('' as any)) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private readError(err: unknown): string | null {
    if (!err) {
      return null;
    }
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err === 'string') {
      return err;
    }
    if ((err as any)?.error?.message) {
      return String((err as any).error.message);
    }
    return null;
  }
}

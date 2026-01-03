import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../../components/toast/toast.service';
import { ComplementaryTaskCategoryDTO } from '../../models/complementary-task-category';
import {
  ComplementaryTaskDTO,
  ComplementaryTaskFilters,
  ComplementaryTaskMode,
  ComplementaryTaskStatus,
  CreateComplementaryTaskDTO,
  UpdateComplementaryTaskDTO,
} from '../../models/complementary-task';
import { ComplementaryTaskCategoriesService } from '../../services/complementary-task-categories/complementary-task-categories.service';
import { ComplementaryTasksService } from '../../services/complementary-tasks/complementary-tasks.service';
import { OemApiService, VesselVisitExecutionListItem } from '../../oem/oem-api.service';

type ViewMode = 'list' | 'edit';

@Component({
  selector: 'app-complementary-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './complementary-tasks.component.html',
  styleUrls: ['./complementary-tasks.component.scss'],
})
export class ComplementaryTasksComponent implements OnInit {
  loading = false;
  saving = false;
  error: string | null = null;

  tasks: ComplementaryTaskDTO[] = [];
  categories: ComplementaryTaskCategoryDTO[] = [];
  vves: VesselVisitExecutionListItem[] = [];

  viewMode: ViewMode = 'list';

  filterVessel = '';
  filterFrom = '';
  filterTo = '';
  filterStatus: ComplementaryTaskStatus | '' = '';

  createCompleted = false;
  newTask: CreateComplementaryTaskDTO = {
    categoryId: 0,
    vveId: 0,
    team: '',
    mode: 'PARALLEL',
    startTime: '',
    endTime: undefined,
  };

  editing: ComplementaryTaskDTO | null = null;
  editingPayload: UpdateComplementaryTaskDTO | null = null;
  editCompleted = false;

  readonly statusOptions = [
    { value: 'ONGOING' as ComplementaryTaskStatus, label: 'Ongoing' },
    { value: 'COMPLETED' as ComplementaryTaskStatus, label: 'Completed' },
  ];

  readonly modeOptions = [
    { value: 'PARALLEL' as ComplementaryTaskMode, label: 'Parallel' },
    { value: 'SUSPENDS' as ComplementaryTaskMode, label: 'Suspends ops' },
  ];

  constructor(
    private readonly service: ComplementaryTasksService,
    private readonly categoriesService: ComplementaryTaskCategoriesService,
    private readonly oemApi: OemApiService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.newTask.startTime = this.nowLocalInput();
    await this.loadReferenceData();
    await this.loadTasks();
  }

  async loadReferenceData(): Promise<void> {
    try {
      const [categories, vves] = await Promise.all([
        this.categoriesService.list(),
        firstValueFrom(this.oemApi.getVesselVisitExecutions()),
      ]);
      this.categories = categories;
      this.vves = vves || [];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao carregar dados de referencia.';
      this.error = message;
      this.toast.error(message);
    } finally {
      this.cdr.markForCheck();
    }
  }

  async loadTasks(): Promise<void> {
    this.loading = true;
    this.error = null;
    const filters: ComplementaryTaskFilters = {};

    if (this.filterVessel.trim()) {
      filters.vesselIdentifier = this.filterVessel.trim();
    }
    if (this.filterStatus) {
      filters.status = this.filterStatus;
    }
    if (this.filterFrom) {
      const from = this.toIsoOptional(this.filterFrom);
      if (from) filters.from = from;
    }
    if (this.filterTo) {
      const to = this.toIsoOptional(this.filterTo);
      if (to) filters.to = to;
    }

    try {
      this.tasks = await this.service.list(filters);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao carregar tarefas.';
      this.error = message;
      this.toast.error(message);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  resetFilters(): void {
    this.filterVessel = '';
    this.filterFrom = '';
    this.filterTo = '';
    this.filterStatus = '';
    this.loadTasks();
  }

  async createTask(): Promise<void> {
    this.error = null;
    if (!this.newTask.categoryId) {
      this.error = 'Categoria obrigatoria.';
      return;
    }
    if (!this.newTask.vveId) {
      this.error = 'Selecione a VVE.';
      return;
    }
    if (!this.newTask.team.trim()) {
      this.error = 'Equipa responsavel obrigatoria.';
      return;
    }
    const startIso = this.toIsoOptional(this.newTask.startTime);
    if (!startIso) {
      this.error = 'Hora de inicio invalida.';
      return;
    }

    const payload: CreateComplementaryTaskDTO = {
      categoryId: Number(this.newTask.categoryId),
      vveId: Number(this.newTask.vveId),
      team: this.newTask.team.trim(),
      mode: this.newTask.mode,
      startTime: startIso,
    };

    if (this.createCompleted) {
      const endIso = this.toIsoOptional(this.newTask.endTime);
      if (!endIso) {
        this.error = 'Defina o end time para concluir.';
        return;
      }
      payload.endTime = endIso;
    }

    this.saving = true;
    try {
      const created = await this.service.create(payload);
      this.tasks = [created, ...this.tasks];
      this.toast.success('Tarefa criada');
      this.resetNewTask();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao criar tarefa.';
      this.error = message;
      this.toast.error(message);
    } finally {
      this.saving = false;
    }
  }

  openEdit(task: ComplementaryTaskDTO): void {
    this.editing = task;
    this.viewMode = 'edit';
    this.editCompleted = Boolean(task.endTime);
    this.editingPayload = {
      categoryId: task.categoryId,
      team: task.team,
      mode: task.mode,
      startTime: this.toLocalInput(task.startTime),
      endTime: task.endTime ? this.toLocalInput(task.endTime) : null,
    };
  }

  closeEdit(): void {
    this.editing = null;
    this.editingPayload = null;
    this.editCompleted = false;
    this.viewMode = 'list';
  }

  async saveEdit(): Promise<void> {
    if (!this.editing || !this.editingPayload) return;
    this.error = null;

    const payload: UpdateComplementaryTaskDTO = {
      categoryId: Number(this.editingPayload.categoryId),
      team: (this.editingPayload.team || '').trim(),
      mode: this.editingPayload.mode,
      startTime: this.editingPayload.startTime
        ? this.toIsoOptional(this.editingPayload.startTime)
        : undefined,
    };

    if (this.editCompleted) {
      const endIso = this.toIsoOptional(this.editingPayload.endTime || '');
      if (!endIso) {
        this.error = 'Defina o end time para concluir.';
        return;
      }
      payload.endTime = endIso;
    }

    this.saving = true;
    try {
      const updated = await this.service.update(this.editing.id, payload);
      this.tasks = this.tasks.map((item) => (item.id === updated.id ? updated : item));
      this.toast.success('Tarefa atualizada');
      this.closeEdit();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao guardar tarefa.';
      this.error = message;
      this.toast.error(message);
    } finally {
      this.saving = false;
    }
  }

  async deleteTask(task: ComplementaryTaskDTO): Promise<void> {
    const confirmDelete = window.confirm(`Remover tarefa ${task.identifier}?`);
    if (!confirmDelete) return;

    try {
      await this.service.delete(task.id);
      this.tasks = this.tasks.filter((item) => item.id !== task.id);
      this.toast.success('Tarefa removida');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao remover tarefa.';
      this.error = message;
      this.toast.error(message);
    }
  }

  categoryLabel(categoryId: number): string {
    const entry = this.categories.find((c) => c.id === categoryId);
    return entry ? `${entry.code} - ${entry.name}` : `#${categoryId}`;
  }

  vveLabel(vveId: number): string {
    const entry = this.vves.find((vve) => vve.id === vveId);
    if (!entry) return `#${vveId}`;
    return `#${entry.id} ${entry.vesselName}`;
  }

  statusLabel(value: ComplementaryTaskStatus): string {
    return this.statusOptions.find((s) => s.value === value)?.label ?? value;
  }

  modeLabel(value: ComplementaryTaskMode): string {
    return this.modeOptions.find((m) => m.value === value)?.label ?? value;
  }

  formatDate(value?: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  private resetNewTask(): void {
    this.newTask = {
      categoryId: 0,
      vveId: 0,
      team: '',
      mode: 'PARALLEL',
      startTime: this.nowLocalInput(),
      endTime: undefined,
    };
    this.createCompleted = false;
  }

  private nowLocalInput(): string {
    return this.toLocalInput(new Date().toISOString());
  }

  private toIsoOptional(value?: string | null): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  }

  private toLocalInput(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => `${n}`.padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
}

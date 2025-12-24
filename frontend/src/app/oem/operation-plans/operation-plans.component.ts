import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  OemApiService,
  OperationPlanDto,
  OperationPlanPreviewDto,
  MissingOperationPlanDto,
  OperationPlanTaskDto,
} from '../oem-api.service';

type SortKey = 'name' | 'plannedStartTime' | 'vesselVisitId' | 'createdAt';

@Component({
  selector: 'app-oem-operation-plans',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './operation-plans.component.html',
  styleUrls: ['./operation-plans.component.scss'],
})
export class OemOperationPlansComponent implements OnInit {
  form: FormGroup;
  savedFilterForm: FormGroup;

  plans: OperationPlanDto[] = [];
  previewPlans: OperationPlanPreviewDto[] = [];

  loading = false;
  error: string | null = null;

  previewLoading = false;
  previewError: string | null = null;

  persistLoading = false;
  persistError: string | null = null;
  successMessage: string | null = null;

  expandedRows = new Set<number>();
  selectedVvns = new Set<number>();
  savedEmptyMessage: string | null = null;

  sortKey: SortKey = 'plannedStartTime';
  sortDir: 'asc' | 'desc' = 'asc';

  editForm: FormGroup;
  editingPlan: OperationPlanDto | null = null;
  editLoading = false;
  editSaving = false;
  editError: string | null = null;
  editWarnings: string[] = [];
  editSuccess: string | null = null;

  missingForm: FormGroup;
  missingPlans: MissingOperationPlanDto[] = [];
  missingLoading = false;
  missingError: string | null = null;
  missingEmptyMessage: string | null = null;
  regenerateLoading = false;
  regenerateError: string | null = null;
  regenerateSuccess: string | null = null;

  readonly algorithms = [{ id: 'single-crane', label: 'Single crane' }];

  readonly planStatuses = [
    'draft',
    'planned',
    'in-progress',
    'completed',
    'cancelled',
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: OemApiService,
  ) {
    this.form = this.fb.group({
      date: [this.todayIso(), Validators.required],
    });

    this.savedFilterForm = this.fb.group({
      from: [''],
      to: [''],
      vesselVisitId: [''],
    });

    this.missingForm = this.fb.group({
      date: [this.todayIso(), Validators.required],
      algorithm: ['single-crane', Validators.required],
      confirmOverwrite: [false],
    });

    this.editForm = this.createEditForm();
  }

  ngOnInit(): void {
    this.fetchPlans();
  }

  get dateControl() {
    return this.form.get('date');
  }

  get hasPreview(): boolean {
    return this.previewPlans.length > 0;
  }

  get missingDateControl() {
    return this.missingForm.get('date');
  }

  get hasMissingPlans(): boolean {
    return this.missingPlans.length > 0;
  }

  get sortedPlans(): OperationPlanDto[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...this.plans].sort((a, b) => {
      const av = this.sortValue(a);
      const bv = this.sortValue(b);
      if (av === bv) {
        return 0;
      }
      return av > bv ? dir : -dir;
    });
  }

  onPreview(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const date = this.form.value.date;
    this.previewLoading = true;
    this.previewError = null;
    this.persistError = null;
    this.successMessage = null;

    this.api
      .previewOperationPlans(date, 'single-crane', this.selectedAsArray())
      .pipe(finalize(() => (this.previewLoading = false)))
      .subscribe({
        next: plans => {
          this.previewPlans = plans ?? [];
          this.expandedRows.clear();
          this.selectedVvns = new Set(this.previewPlans.map(p => p.vvnId));
          if (!this.previewPlans.length) {
            this.previewError =
              'Nenhum plano de operacao disponivel para a data selecionada.';
          }
        },
        error: (err: HttpErrorResponse) => {
          if (Array.isArray(err.error)) {
            this.previewPlans = err.error as OperationPlanPreviewDto[];
            this.previewError = this.previewPlans.length
              ? null
              : 'Nenhum plano de operacao disponivel para a data selecionada.';
            return;
          }

          this.previewPlans = [];
          this.selectedVvns.clear();
          this.previewError = this.normalizeError(
            err,
            'Falha ao gerar o preview dos planos de operacao.',
          );
        },
      });
  }

  onPersist(): void {
    if (this.form.invalid || !this.previewPlans.length) {
      this.form.markAllAsTouched();
      return;
    }

    const date = this.form.value.date;
    const vvnIds = this.selectedAsArray();

    this.persistLoading = true;
    this.persistError = null;
    this.successMessage = null;

    this.api
      .generateOperationPlans(
        date,
        'single-crane',
        vvnIds.length ? vvnIds : undefined,
      )
      .pipe(finalize(() => (this.persistLoading = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'Planos guardados com sucesso.';
          this.previewPlans = [];
          this.selectedVvns.clear();
          this.expandedRows.clear();
          this.fetchPlans();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 409) {
            this.persistError = 'Ja existem planos para esta data.';
            return;
          }

          if (err.status === 0) {
            this.persistError =
              'Falha ao guardar os planos de operacao (erro de rede).';
            this.fetchPlans();
            return;
          }

          this.persistError = this.normalizeError(
            err,
            'Falha ao guardar os planos de operacao.',
          );
        },
      });
  }

  fetchPlans(): void {
    const { from, to, vesselVisitId } = this.savedFilterForm.value;
    this.loading = true;
    this.error = null;
    this.savedEmptyMessage = null;

    this.api
      .getOperationPlans({
        from: from || undefined,
        to: to || undefined,
        vesselVisitId: vesselVisitId || undefined,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: plans => {
          const data = Array.isArray(plans) ? plans : [];
          this.plans = data;
          this.savedEmptyMessage = this.plans.length
            ? null
            : 'Nenhum plano encontrado para os filtros aplicados.';
          this.loading = false;
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.normalizeError(
            err,
            'Falha ao carregar os planos guardados.',
          );
          this.savedEmptyMessage = null;
          this.loading = false;
        },
      });
  }

  onSearchSaved(): void {
    this.fetchPlans();
  }

  resetSavedFilters(): void {
    this.savedFilterForm.reset({
      from: '',
      to: '',
      vesselVisitId: '',
    });
    this.fetchPlans();
  }

  fetchMissingPlans(): void {
    if (this.missingForm.invalid) {
      this.missingForm.markAllAsTouched();
      return;
    }

    const date = this.missingForm.value.date;
    this.missingLoading = true;
    this.missingError = null;
    this.missingEmptyMessage = null;
    this.regenerateError = null;
    this.regenerateSuccess = null;

    this.api
      .getMissingOperationPlans(date)
      .pipe(finalize(() => (this.missingLoading = false)))
      .subscribe({
        next: plans => {
          this.missingPlans = plans ?? [];
          this.missingEmptyMessage = this.missingPlans.length
            ? null
            : 'Nao existem VVNs sem plano para o dia selecionado.';
        },
        error: (err: HttpErrorResponse) => {
          this.missingError = this.normalizeError(
            err,
            'Falha ao carregar VVNs sem plano.',
          );
          this.missingEmptyMessage = null;
        },
      });
  }

  onSearchMissing(): void {
    this.fetchMissingPlans();
  }

  onRegenerateMissing(): void {
    if (this.missingForm.invalid || !this.missingPlans.length) {
      this.missingForm.markAllAsTouched();
      return;
    }

    const { date, algorithm, confirmOverwrite } = this.missingForm.value;

    if (!confirmOverwrite) {
      this.regenerateError =
        'Confirme o overwrite antes de regenerar os planos do dia.';
      this.missingForm.get('confirmOverwrite')?.markAsTouched();
      return;
    }

    this.regenerateLoading = true;
    this.regenerateError = null;
    this.regenerateSuccess = null;

    this.api
      .regenerateMissingOperationPlans(date, algorithm, confirmOverwrite)
      .pipe(finalize(() => (this.regenerateLoading = false)))
      .subscribe({
        next: () => {
          this.regenerateSuccess =
            'Regeneracao concluida. Os planos foram atualizados.';
          this.fetchPlans();
          this.fetchMissingPlans();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 409) {
            this.regenerateError =
              'Existem planos para esta data. Confirme o overwrite para continuar.';
            return;
          }

          this.regenerateError = this.normalizeError(
            err,
            'Falha ao regenerar os planos do dia.',
          );
        },
      });
  }

  startEdit(plan: OperationPlanDto): void {
    this.editingPlan = plan;
    this.editForm = this.createEditForm(plan);
    this.editLoading = false;
    this.editError = null;
    this.editWarnings = [];
    this.editSuccess = null;
  }

  cancelEdit(): void {
    this.editingPlan = null;
    this.editForm = this.createEditForm();
    this.editWarnings = [];
    this.editSuccess = null;
    this.editError = null;
  }

  onSaveEdit(): void {
    if (!this.editingPlan) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.editError = 'Preencha motivo e estado antes de guardar.';
      return;
    }

    const payload = this.buildUpdatePayload();

    this.editSaving = true;
    this.editError = null;
    this.editWarnings = [];
    this.editSuccess = null;

    this.api
      .updateOperationPlan(this.editingPlan.id, payload)
      .pipe(finalize(() => (this.editSaving = false)))
      .subscribe({
        next: response => {
          this.editingPlan = response.plan;
          this.editWarnings = response.warnings ?? [];
          this.editSuccess = 'Plano atualizado e alteracao registada.';
          this.editForm = this.createEditForm(response.plan);
          this.plans = this.plans.map(p =>
            p.id === response.plan.id ? response.plan : p,
          );
        },
        error: (err: HttpErrorResponse) => {
          this.editError = this.normalizeError(err, 'Falha ao atualizar o plano.');
        },
      });
  }

  changeSort(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
  }

  toggleExpanded(vvnId: number): void {
    if (this.expandedRows.has(vvnId)) {
      this.expandedRows.delete(vvnId);
    } else {
      this.expandedRows.add(vvnId);
    }
  }

  isExpanded(vvnId: number): boolean {
    return this.expandedRows.has(vvnId);
  }

  toggleSelected(vvnId: number): void {
    if (this.selectedVvns.has(vvnId)) {
      this.selectedVvns.delete(vvnId);
    } else {
      this.selectedVvns.add(vvnId);
    }
  }

  isSelected(vvnId: number): boolean {
    return this.selectedVvns.has(vvnId);
  }

  trackByVvn(_: number, item: OperationPlanPreviewDto): number {
    return item.vvnId;
  }

  private selectedAsArray(): number[] {
    return Array.from(this.selectedVvns);
  }

  private sortValue(plan: OperationPlanDto): string | number {
    switch (this.sortKey) {
      case 'name':
        return plan.name?.toLowerCase() ?? '';
      case 'vesselVisitId':
        return plan.vesselVisitId?.toString().toLowerCase() ?? '';
      case 'createdAt':
        return plan.createdAt ? new Date(plan.createdAt).getTime() : 0;
      case 'plannedStartTime':
      default:
        return plan.plannedStartTime
          ? new Date(plan.plannedStartTime).getTime()
          : 0;
    }
  }

  private normalizeError(err: HttpErrorResponse, fallback: string): string {
    if (err?.error?.message) {
      return err.error.message;
    }
    if (typeof err?.error === 'string') {
      return err.error;
    }
    if (err?.status === 0) {
      return `${fallback} (verifique a rede ou o proxy).`;
    }
    return fallback;
  }

  private todayIso(): string {
    const now = new Date();
    const pad = (v: number) => v.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  private createEditForm(plan?: OperationPlanDto): FormGroup {
    return this.fb.group({
      dockId: [plan?.dockId ?? ''],
      status: [plan?.status ?? 'planned', Validators.required],
      reason: ['', Validators.required],
      tasks: this.fb.array(
        (plan?.tasks ?? []).map(task => this.buildTaskGroup(task)),
      ),
    });
  }

  get taskControls(): FormArray {
    return this.editForm.get('tasks') as FormArray;
  }

  addTask(): void {
    this.taskControls.push(this.buildTaskGroup());
  }

  removeTask(index: number): void {
    this.taskControls.removeAt(index);
  }

  private buildTaskGroup(task?: OperationPlanTaskDto) {
    const staff = (task?.staffIds ?? []).join(', ');
    return this.fb.group({
      id: [task?.id ?? null],
      type: [task?.type ?? '', Validators.required],
      craneId: [task?.craneId ?? ''],
      storageAreaId: [task?.storageAreaId ?? ''],
      staffIdsText: [staff],
      startTime: [task?.startTime ?? '', Validators.required],
      endTime: [task?.endTime ?? '', Validators.required],
    });
  }

  /**
   * Backend expects: { reason, dockId?, status?, tasks? }
   */
  private buildUpdatePayload(): { reason: string } & Partial<OperationPlanDto> {
    const value = this.editForm.value as any;

    const tasksArray = this.taskControls.getRawValue() as any[];
    const tasks = tasksArray.map(raw => {
      const staffIds = this.parseStaffIds(raw.staffIdsText as string | undefined);
      return {
        id: raw.id ?? undefined,
        type: (raw.type as string)?.trim(),
        craneId: raw.craneId || undefined,
        storageAreaId: raw.storageAreaId || undefined,
        staffIds,
        startTime: raw.startTime,
        endTime: raw.endTime,
      };
    });

    return {
      reason: (value.reason as string)?.trim(),
      dockId: value.dockId || undefined,
      status: value.status,
      tasks,
    };
  }

  private parseStaffIds(value?: string): string[] | undefined {
    if (!value) {
      return undefined;
    }
    const parts = value
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);
    return parts.length ? parts : undefined;
  }
}

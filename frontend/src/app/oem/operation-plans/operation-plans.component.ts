import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TimeoutError } from 'rxjs';
import { finalize, timeout } from 'rxjs/operators';
import {
  OemApiService,
  OperationPlanDto,
  OperationPlanPreviewDto,
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

  expandedRows = new Set<string>();
  selectedVvns = new Set<string>();
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
      .pipe(
        finalize(() => {
          this.previewLoading = false;
        }),
      )
      .subscribe({
        next: plans => {
          this.previewPlans = plans ?? [];
          this.expandedRows.clear();
          this.selectedVvns = new Set(this.previewPlans.map(p => p.vvnId));
          if (!this.previewPlans.length) {
            this.previewError =
              'Nenhum plano de operação disponível para a data selecionada.';
          }
        },
        error: (err: HttpErrorResponse) => {
          if (Array.isArray(err.error)) {
            this.previewPlans = err.error as OperationPlanPreviewDto[];
            this.previewError = this.previewPlans.length
              ? null
              : 'Nenhum plano de operação disponível para a data selecionada.';
            return;
          }

          this.previewPlans = [];
          this.selectedVvns.clear();
          this.previewError = this.normalizeError(
            err,
            'Falha ao gerar o preview dos planos de operação.',
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
            this.persistError = 'Já existem planos para esta data.';
            return;
          }

          if (err.status === 0) {
            this.persistError =
              'Falha ao guardar os planos de operação (erro de rede).';
            this.fetchPlans();
            return;
          }

          this.persistError = this.normalizeError(
            err,
            'Falha ao guardar os planos de operação.',
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
      .pipe(
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: plans => {
          this.plans = plans ?? [];
          this.savedEmptyMessage = this.plans.length
            ? null
            : 'Nenhum plano encontrado para os filtros aplicados.';
        },
        error: (err: HttpErrorResponse) => {
          // Mantemos os dados anteriores para não "sumir" a lista em caso de falha de rede.
          this.error = this.normalizeError(
            err,
            'Falha ao carregar os planos guardados.',
          );
          this.savedEmptyMessage = null;
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

  startEdit(plan: OperationPlanDto): void {
    this.editingPlan = plan;
    this.editForm = this.createEditForm(plan);
    this.editLoading = true;
    this.editError = null;
    this.editWarnings = [];
    this.editSuccess = null;

    if (!plan?.id) {
      this.editLoading = false;
      this.editWarnings = ['Plano sem identificador. Recarregue a página ou escolha outro plano.'];
      return;
    }

    this.api
      .getOperationPlan(plan.id)
      .pipe(
        timeout(5000),
        finalize(() => {
          this.editLoading = false;
        }),
      )
      .subscribe({
        next: fullPlan => {
          this.editingPlan = fullPlan;
          this.editForm = this.createEditForm(fullPlan);
        },
        error: (err: HttpErrorResponse) => {
          if (err instanceof TimeoutError || err.name === 'TimeoutError') {
            this.editError = 'Tempo esgotado a carregar detalhes do plano. Verifique se o OEM está acessível em HTTPS na porta configurada.';
            return;
          }

          if (err.status === 0) {
            this.editWarnings = [
              'Não foi possível atualizar os detalhes do plano (rede/proxy). A editar com os dados atuais.',
            ];
            this.editError = null;
            return;
          }
          this.editError = this.normalizeError(err, 'Falha ao carregar o plano para edicao.');
        },
      });
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
      return;
    }

    const payload = this.buildUpdatePayload();

    this.editSaving = true;
    this.editError = null;
    this.editWarnings = [];
    this.editSuccess = null;

    this.api
      .updateOperationPlan(this.editingPlan.id, payload)
      .pipe(
        finalize(() => {
          this.editSaving = false;
        }),
      )
      .subscribe({
        next: response => {
          this.editingPlan = response.plan;
          this.editWarnings = response.warnings ?? [];
          this.editSuccess = 'Plano atualizado e alteracao registada.';
          this.editForm = this.createEditForm(response.plan);
          this.plans = this.plans.map(p => (p.id === response.plan.id ? response.plan : p));
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

  toggleExpanded(vvnId: string): void {
    if (this.expandedRows.has(vvnId)) {
      this.expandedRows.delete(vvnId);
    } else {
      this.expandedRows.add(vvnId);
    }
  }

  isExpanded(vvnId: string): boolean {
    return this.expandedRows.has(vvnId);
  }

  toggleSelected(vvnId: string): void {
    if (this.selectedVvns.has(vvnId)) {
      this.selectedVvns.delete(vvnId);
    } else {
      this.selectedVvns.add(vvnId);
    }
  }

  isSelected(vvnId: string): boolean {
    return this.selectedVvns.has(vvnId);
  }

  trackByVvn(_: number, item: OperationPlanPreviewDto): string {
    return item.vvnId;
  }

  private selectedAsArray(): string[] {
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
    const form = this.fb.group({
      dockId: [plan?.dockId ?? ''],
      status: [plan?.status ?? 'planned', Validators.required],
      reason: ['', Validators.required],
    });
    return form;
  }

  private buildUpdatePayload(): { reason: string } & Partial<OperationPlanDto> {
    const value = this.editForm.value as any;

    return {
      reason: (value.reason as string)?.trim(),
      dockId: value.dockId || undefined,
      status: value.status,
    };
  }
}

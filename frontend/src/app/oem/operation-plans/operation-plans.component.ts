import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  OemApiService,
  OperationPlanDto,
  OperationPlanPreviewDto,
} from '../oem-api.service';

@Component({
  selector: 'app-oem-operation-plans',
  templateUrl: './operation-plans.component.html',
  styleUrls: ['./operation-plans.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
})
export class OemOperationPlansComponent implements OnInit {
  form: FormGroup;
  savedFilterForm: FormGroup;
  plans: OperationPlanDto[] = [];
  loading = false;
  error: string | null = null;
  previewPlans: OperationPlanPreviewDto[] = [];
  previewLoading = false;
  previewError: string | null = null;
  persistLoading = false;
  persistError: string | null = null;
  successMessage: string | null = null;
  private readonly expandedRows = new Set<string>();
  private readonly selectedVvns = new Set<string>();
  sortKey: 'name' | 'plannedStartTime' | 'vesselVisitId' | 'createdAt' = 'plannedStartTime';
  sortDir: 'asc' | 'desc' = 'asc';

  constructor(private readonly oemApi: OemApiService, private readonly formBuilder: FormBuilder) {
    this.form = this.formBuilder.group({
      date: ['', Validators.required],
    });

    this.savedFilterForm = this.formBuilder.group({
      from: [''],
      to: [''],
      vesselVisitId: [''],
    });
  }

  ngOnInit(): void {
    this.fetchPlans();
  }

  get hasPreview(): boolean {
    return this.previewPlans.length > 0;
  }

  get dateControl(): FormControl<string | null> {
    return this.form.get('date') as FormControl<string | null>;
  }

  get savedFromControl(): FormControl<string | null> {
    return this.savedFilterForm.get('from') as FormControl<string | null>;
  }

  get savedToControl(): FormControl<string | null> {
    return this.savedFilterForm.get('to') as FormControl<string | null>;
  }

  get savedVesselControl(): FormControl<string | null> {
    return this.savedFilterForm.get('vesselVisitId') as FormControl<string | null>;
  }

  get sortedPlans(): OperationPlanDto[] {
    const copy = [...this.plans];
    const dir = this.sortDir === 'asc' ? 1 : -1;

    return copy.sort((a, b) => {
      const av = (a[this.sortKey] as string | null | undefined) ?? '';
      const bv = (b[this.sortKey] as string | null | undefined) ?? '';
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
  }

  private fetchPlans(): void {
    this.loading = true;
    this.error = null;
    this.oemApi
      .getOperationPlans()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (plans) => {
          this.plans = plans ?? [];
        },
        error: (err) => {
          console.error('Failed to load operation plans', err);
          this.plans = [];
        },
      });
  }

  onSearchSaved(): void {
    const from = (this.savedFilterForm.value.from as string | undefined) || undefined;
    const to = (this.savedFilterForm.value.to as string | undefined) || undefined;
    const vesselVisitId =
      (this.savedFilterForm.value.vesselVisitId as string | undefined)?.trim() || undefined;

    this.loading = true;
    this.error = null;
    this.oemApi
      .getOperationPlans({ from, to, vesselVisitId })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (plans) => {
          this.plans = plans ?? [];
          this.error = null;
        },
        error: (err) => {
          console.error('Failed to load filtered operation plans', err);
          // Em alguns ambientes o Angular devolve status 0 mesmo que o
          // backend esteja acessível; nestes casos mostramos simplesmente
          // uma lista vazia em vez de um erro vermelho.
          if (err.status === 0) {
            this.error = null;
            this.plans = [];
          } else {
            this.error = 'Falha ao carregar os planos guardados.';
            this.plans = [];
          }
        },
      });
  }

  resetSavedFilters(): void {
    this.savedFilterForm.reset({ from: '', to: '', vesselVisitId: '' });
    this.fetchPlans();
  }

  changeSort(key: 'name' | 'plannedStartTime' | 'vesselVisitId' | 'createdAt'): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
  }

  onPreview(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const date = (this.form.value.date as string) ?? '';
    this.previewLoading = true;
    this.previewError = null;
    this.successMessage = null;
    this.persistError = null;

    this.oemApi
      .previewOperationPlans(date)
      .pipe(
        finalize(() => {
          this.previewLoading = false;
        }),
      )
      .subscribe({
        next: (plans) => {
          console.debug('Preview OK', plans);
          this.previewPlans = plans ?? [];
          this.expandedRows.clear();
          this.selectedVvns.clear();
          this.previewError = this.previewPlans.length
            ? null
            : 'Nenhum plano de operação disponível para a data selecionada.';
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to preview operation plans', err);
          // Se já temos planos carregados, mantemos o preview atual
          // e só registamos o erro em consola (por ex. erro intermitente
          // de rede ou pedido duplicado).
          if (this.previewPlans.length > 0) {
            return;
          }

          if (Array.isArray(err.error)) {
            console.debug('Preview payload returned in error channel', err.error);
            this.previewPlans = err.error as OperationPlanPreviewDto[];
            this.selectedVvns.clear();
            this.previewError = this.previewPlans.length
              ? null
              : 'Nenhum plano de operação disponível para a data selecionada.';
          } else {
            this.previewPlans = [];
            this.previewError =
              err.error?.message ||
              (err.status
                ? `Falha ao gerar o preview (HTTP ${err.status}).`
                : 'Falha ao gerar o preview dos planos de operação.');
          }
        },
      });
  }

  onPersist(): void {
    if (this.form.invalid || !this.previewPlans.length) {
      return;
    }

    const date = (this.form.value.date as string) ?? '';
    const vvnIds = Array.from(this.selectedVvns);
    this.persistLoading = true;
    this.persistError = null;
    this.successMessage = null;

    this.oemApi
      .generateOperationPlans(date, 'single-crane', vvnIds)
      .pipe(finalize(() => (this.persistLoading = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'Planos guardados com sucesso.';
          this.previewPlans = [];
          this.expandedRows.clear();
          this.selectedVvns.clear();
          this.fetchPlans();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to persist operation plans', err);
          if (err.status === 409) {
            this.persistError =
              'Operation Plans for this day already exist. Please use regeneration flow (4.1.5).';
            return;
          }

          // Em alguns ambientes o pedido pode ter sido bem-sucedido no backend
          // mas o Angular reporta um erro de rede (status 0). Nesses casos,
          // verificamos se o plano para o dia selecionado já aparece na lista
          // de "Planos guardados" e, se sim, tratamos como sucesso.
          if (err.status === 0) {
            this.oemApi.getOperationPlans().subscribe({
              next: (plans) => {
                this.plans = plans ?? [];
                const day = date.trim();
                const hasPlanForDay = (plans ?? []).some((p) => {
                  const targetDay = p.targetDay ?? p.plannedStartTime ?? '';
                  return !!day && targetDay.startsWith(day);
                });

                if (hasPlanForDay) {
                  this.successMessage = 'Planos guardados com sucesso.';
                  this.previewPlans = [];
                  this.expandedRows.clear();
                  this.selectedVvns.clear();
                  return;
                }

                this.persistError =
                  'Falha ao guardar os planos de operação (erro de rede).';
              },
              error: () => {
                this.persistError =
                  err.error?.message || 'Falha ao guardar os planos de operação.';
              },
            });
          } else {
            this.persistError =
              err.error?.message || 'Falha ao guardar os planos de operação.';
          }
        },
      });
  }

  isExpanded(vvnId: string): boolean {
    return this.expandedRows.has(vvnId);
  }

  toggleExpanded(vvnId: string): void {
    if (this.expandedRows.has(vvnId)) {
      this.expandedRows.delete(vvnId);
    } else {
      this.expandedRows.add(vvnId);
    }
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
}

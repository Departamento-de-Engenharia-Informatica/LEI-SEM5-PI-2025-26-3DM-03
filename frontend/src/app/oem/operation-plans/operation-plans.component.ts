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

  constructor(private readonly oemApi: OemApiService, private readonly formBuilder: FormBuilder) {
    this.form = this.formBuilder.group({
      date: ['', Validators.required],
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
          // Em contexto de desenvolvimento, se o backend OEM não estiver
          // disponível ou responder com erro, mostramos simplesmente a
          // lista vazia em vez de um erro vermelho permanente na UI.
          this.plans = [];
        },
      });
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
          this.previewPlans = plans ?? [];
          this.expandedRows.clear();
          this.previewError = this.previewPlans.length
            ? null
            : 'Nenhum plano de operação disponível para a data selecionada.';
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to preview operation plans', err);
          this.previewLoading = false;
          if (Array.isArray(err.error)) {
            this.previewPlans = err.error as OperationPlanPreviewDto[];
            this.previewError = this.previewPlans.length
              ? null
              : 'Nenhum plano de operação disponível para a data selecionada.';
          } else {
            this.previewPlans = [];
            this.previewError =
              err.error?.message || 'Falha ao gerar o preview dos planos de operação.';
          }
        },
      });
  }

  onPersist(): void {
    if (this.form.invalid || !this.previewPlans.length) {
      return;
    }

    const date = (this.form.value.date as string) ?? '';
    this.persistLoading = true;
    this.persistError = null;
    this.successMessage = null;

    this.oemApi
      .generateOperationPlans(date)
      .pipe(finalize(() => (this.persistLoading = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'Planos guardados com sucesso.';
          this.previewPlans = [];
          this.expandedRows.clear();
          this.fetchPlans();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to persist operation plans', err);
          if (err.status === 409) {
            this.persistError =
              'Operation Plans for this day already exist. Please use regeneration flow (4.1.5).';
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

  trackByVvn(_: number, item: OperationPlanPreviewDto): string {
    return item.vvnId;
  }
}

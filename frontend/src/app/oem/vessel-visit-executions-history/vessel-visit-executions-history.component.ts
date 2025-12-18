import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { OemApiService, VesselVisitExecutionListItem } from '../oem-api.service';

@Component({
  selector: 'app-vessel-visit-executions-history',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vessel-visit-executions-history.component.html',
  styleUrls: ['./vessel-visit-executions-history.component.scss'],
})
export class VesselVisitExecutionsHistoryComponent implements OnInit {
  filterForm: FormGroup;

  executions: VesselVisitExecutionListItem[] = [];
  loading = false;
  error: string | null = null;
  emptyMessage: string | null = null;

  readonly statusOptions = [
    'scheduled',
    'pending',
    'in-progress',
    'active',
    'completed',
    'cancelled',
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: OemApiService,
  ) {
    this.filterForm = this.fb.group({
      from: [''],
      to: [''],
      vesselVisitId: ['', [Validators.pattern(/^\d*$/)]],
      vesselName: [''],
      status: [''],
    });
  }

  ngOnInit(): void {
    this.fetchExecutions();
  }

  onSearch(): void {
    this.fetchExecutions();
  }

  resetFilters(): void {
    this.filterForm.reset({
      from: '',
      to: '',
      vesselVisitId: '',
      vesselName: '',
      status: '',
    });
    this.fetchExecutions();
  }

  displayMinutes(value?: number | null): string {
    if (value === null || value === undefined) return '-';
    return `${value} min`;
  }

  formatDelay(value?: number | null): string {
    if (value === null || value === undefined) return '-';
    if (value > 0) return `+${value} min`;
    if (value < 0) return `${value} min`;
    return '0 min';
  }

  trackById(_: number, item: VesselVisitExecutionListItem): number {
    return item.id;
  }

  private fetchExecutions(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      return;
    }

    const filters = this.buildFilters();
    this.loading = true;
    this.error = null;
    this.emptyMessage = null;

    this.api
      .getVesselVisitExecutions(filters)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (items) => {
          this.executions = items ?? [];
          this.emptyMessage = this.executions.length
            ? null
            : 'Nenhuma execucao encontrada para os filtros aplicados.';
        },
        error: (err: HttpErrorResponse) => {
          this.executions = [];
          this.error = this.normalizeError(err, 'Falha ao carregar as execucoes.');
        },
      });
  }

  private buildFilters(): {
    from?: string;
    to?: string;
    vesselVisitId?: number;
    vesselName?: string;
    status?: string;
  } {
    const raw = this.filterForm.value as {
      from?: string;
      to?: string;
      vesselVisitId?: string;
      vesselName?: string;
      status?: string;
    };

    const filters: {
      from?: string;
      to?: string;
      vesselVisitId?: number;
      vesselName?: string;
      status?: string;
    } = {};

    if (raw.from) filters.from = raw.from;
    if (raw.to) filters.to = raw.to;

    const vesselVisitId = raw.vesselVisitId?.trim();
    if (vesselVisitId) {
      const parsed = Number(vesselVisitId);
      if (!Number.isNaN(parsed)) {
        filters.vesselVisitId = parsed;
      }
    }

    const vesselName = raw.vesselName?.trim();
    if (vesselName) filters.vesselName = vesselName;

    const status = raw.status?.trim();
    if (status) filters.status = status;

    return filters;
  }

  private normalizeError(err: HttpErrorResponse, fallback: string): string {
    if (err?.error?.message) return err.error.message;
    if (typeof err?.error === 'string') return err.error;
    if (err?.status === 0) return `${fallback} (verifique a rede ou o proxy).`;
    return fallback;
  }
}

import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
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

  completeForm: FormGroup | null = null;
  completing: VesselVisitExecutionListItem | null = null;

  createForm: FormGroup;
  creating = false;
  createError: string | null = null;

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

    this.createForm = this.fb.group({
      vvnId: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      actualArrivalTime: ['', [Validators.required]],
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

  startComplete(exec: VesselVisitExecutionListItem): void {
    if (exec.status === 'completed' || exec.status === 'cancelled') {
      return;
    }

    this.completing = exec;
    this.completeForm = this.fb.group({
      actualUnberthTime: [exec.actualUnberthTime || exec.actualDepartureTime || '', Validators.required],
      actualPortDepartureTime: [exec.actualDepartureTime || '', Validators.required],
    });
  }

  cancelComplete(): void {
    this.completing = null;
    this.completeForm = null;
  }

  submitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const raw = this.createForm.value as {
      vvnId: string | number;
      actualArrivalTime: string;
    };

    const parsedId = Number(raw.vvnId);
    const arrival = new Date(raw.actualArrivalTime);

    if (!raw.vvnId || Number.isNaN(parsedId)) {
      this.createError = 'VVN (ID) invalido.';
      return;
    }

    if (Number.isNaN(arrival.getTime())) {
      this.createError = 'Data/hora de chegada invalida.';
      return;
    }

    const payload = {
      vvnId: parsedId,
      actualArrivalTime: arrival.toISOString(),
    };

    this.creating = true;
    this.createError = null;

    this.api
      .getVesselVisitExecutions({ vesselVisitId: parsedId })
      .pipe(
        switchMap((existing) => {
          const list = existing ?? [];
          const hasActive = list.some((e) => e.status !== 'completed' && e.status !== 'cancelled');

          if (hasActive) {
            this.createError = 'Ja existe uma execucao ativa para esse VVN.';
            return EMPTY;
          }

          return this.api.createVesselVisitExecution(payload);
        }),
        finalize(() => (this.creating = false)),
      )
      .subscribe({
        next: () => {
          if (!this.createError) {
            this.createForm.reset({ vvnId: '', actualArrivalTime: '' });
            this.fetchExecutions();
          }
        },
        error: (err: HttpErrorResponse) => {
          this.createError = this.normalizeError(err, 'Falha ao criar a execucao.');
        },
      });
  }

  submitComplete(): void {
    if (!this.completing || !this.completeForm) return;
    if (this.completeForm.invalid) {
      this.completeForm.markAllAsTouched();
      return;
    }

    const raw = this.completeForm.value as {
      actualUnberthTime: string;
      actualPortDepartureTime: string;
    };

    const toIso = (value: string) => {
      if (!value) return '';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString();
    };

    const payload = {
      actualUnberthTime: toIso(raw.actualUnberthTime),
      actualPortDepartureTime: toIso(raw.actualPortDepartureTime),
    };

    if (!payload.actualUnberthTime || !payload.actualPortDepartureTime) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.api
      .completeVesselVisitExecution(this.completing.id, payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          this.cancelComplete();
          this.fetchExecutions();
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.normalizeError(err, 'Falha ao concluir a execucao.');
        },
      });
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

import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import {
  ExecutedOperationDto,
  OemApiService,
  OperationExecutionStatus,
  PlannedOperationWithExecution,
  UpsertExecutedOperationPayload,
  VesselVisitExecutionListItem,
} from '../oem-api.service';

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

  berthForm: FormGroup | null = null;
  updatingBerth: VesselVisitExecutionListItem | null = null;
  berthError: string | null = null;

  operationsTarget: VesselVisitExecutionListItem | null = null;
  operationsForm: FormGroup | null = null;
  operations: PlannedOperationWithExecution[] = [];
  operationsLoading = false;
  operationsError: string | null = null;
  savingOperations = new Set<number>();
  private operationErrors = new Map<number, string>();
  private operationSuccess = new Map<number, string>();

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

  startUpdateBerth(exec: VesselVisitExecutionListItem): void {
    if (exec.status !== 'in-progress') {
      return;
    }

    this.updatingBerth = exec;
    this.berthError = null;

    this.berthForm = this.fb.group({
      actualBerthTime: [exec.actualBerthTime || ''],
      dockId: [exec.berthId || ''],
    });
  }

  cancelUpdateBerth(): void {
    this.updatingBerth = null;
    this.berthForm = null;
    this.berthError = null;
  }

  startRecordOperations(exec: VesselVisitExecutionListItem): void {
    if (exec.status !== 'in-progress') {
      return;
    }

    if (this.operationsTarget && this.operationsTarget.id === exec.id && this.operationsForm) {
      return;
    }

    this.operationsTarget = exec;
    this.operationsLoading = true;
    this.operationsError = null;
    this.operations = [];
    this.operationsForm = null;
    this.operationErrors.clear();
    this.operationSuccess.clear();

    this.api
      .getPlannedOperationsForExecution(exec.id)
      .pipe(finalize(() => (this.operationsLoading = false)))
      .subscribe({
        next: (items) => {
          this.operations = items ?? [];
          this.operationsForm = this.buildOperationsForm(this.operations);
        },
        error: (err: HttpErrorResponse) => {
          this.operationsError = this.normalizeError(
            err,
            'Falha ao carregar as operacoes planeadas.',
          );
        },
      });
  }

  cancelRecordOperations(): void {
    this.operationsTarget = null;
    this.operationsForm = null;
    this.operations = [];
    this.operationsLoading = false;
    this.operationsError = null;
    this.operationErrors.clear();
    this.operationSuccess.clear();
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

  submitBerthUpdate(): void {
    if (!this.updatingBerth || !this.berthForm) return;

    if (this.berthForm.invalid) {
      this.berthForm.markAllAsTouched();
      return;
    }

    const raw = this.berthForm.value as {
      actualBerthTime?: string;
      dockId?: string;
    };

    const toIso = (value?: string) => {
      if (!value) return '';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString();
    };

    const payload: { actualBerthTime?: string; dockId?: string } = {};

    if (raw.actualBerthTime) {
      const iso = toIso(raw.actualBerthTime);
      if (!iso) {
        this.berthError = 'Hora de atracacao invalida.';
        return;
      }
      payload.actualBerthTime = iso;
    }

    if (raw.dockId && raw.dockId.trim()) {
      payload.dockId = raw.dockId.trim();
    }

    if (!payload.actualBerthTime && !payload.dockId) {
      this.berthError = 'Indique pelo menos a hora de atracacao ou o dock usado.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.berthError = null;

    this.api
      .updateVesselVisitExecution(this.updatingBerth.id, payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          this.cancelUpdateBerth();
          this.fetchExecutions();
        },
        error: (err: HttpErrorResponse) => {
          this.berthError = this.normalizeError(err, 'Falha ao atualizar berth/dock.');
        },
      });
  }

  applyPlannedTimes(index: number): void {
    if (!this.operationsForm) return;
    const opsArray = this.operationsArray();
    const group = opsArray.at(index) as FormGroup | undefined;
    const op = this.operations[index];
    if (!group || !op) return;

    group.patchValue(
      {
        actualStartTime: this.isoToInput(op.plannedStartTime),
        actualEndTime: this.isoToInput(op.plannedEndTime),
      },
      { emitEvent: false },
    );
  }

  submitExecutedOperation(index: number): void {
    if (!this.operationsTarget || !this.operationsForm) return;

    const opsArray = this.operationsArray();
    const group = opsArray.at(index) as FormGroup | undefined;
    const operation = this.operations[index];

    if (!group || !operation) return;

    const raw = group.value as {
      actualStartTime?: string;
      actualEndTime?: string;
      resourcesUsed?: string;
    };

    const payload: UpsertExecutedOperationPayload = {};

    if (raw.actualStartTime) {
      const iso = this.inputToIso(raw.actualStartTime);
      if (!iso) {
        this.operationErrors.set(operation.id, 'Hora de inicio invalida.');
        this.operationSuccess.delete(operation.id);
        return;
      }
      payload.actualStartTime = iso;
    }

    if (raw.actualEndTime) {
      const iso = this.inputToIso(raw.actualEndTime);
      if (!iso) {
        this.operationErrors.set(operation.id, 'Hora de fim invalida.');
        this.operationSuccess.delete(operation.id);
        return;
      }
      payload.actualEndTime = iso;
    }

    if (raw.resourcesUsed && raw.resourcesUsed.trim()) {
      try {
        const parsed = JSON.parse(raw.resourcesUsed.trim());
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          this.operationErrors.set(operation.id, 'Recursos devem ser um objeto JSON.');
          this.operationSuccess.delete(operation.id);
          return;
        }
        payload.resourcesUsed = parsed as Record<string, unknown>;
      } catch (error) {
        this.operationErrors.set(operation.id, 'JSON de recursos invalido.');
        this.operationSuccess.delete(operation.id);
        return;
      }
    }

    if (
      payload.actualStartTime === undefined &&
      payload.actualEndTime === undefined &&
      payload.resourcesUsed === undefined
    ) {
      this.operationErrors.set(operation.id, 'Indique pelo menos um campo para atualizar.');
      this.operationSuccess.delete(operation.id);
      return;
    }

    this.operationErrors.delete(operation.id);
    this.operationSuccess.delete(operation.id);
    this.savingOperations.add(operation.id);

    this.api
      .upsertExecutedOperation(this.operationsTarget.id, operation.id, payload)
      .pipe(
        finalize(() => {
          this.savingOperations.delete(operation.id);
        }),
      )
      .subscribe({
        next: (response) => {
          this.operationErrors.delete(operation.id);
          this.operationSuccess.set(operation.id, 'Operacao registada.');
          this.refreshOperationRow(index, response);
        },
        error: (err: HttpErrorResponse) => {
          this.operationErrors.set(
            operation.id,
            this.normalizeError(err, 'Falha ao atualizar a operacao.'),
          );
        },
      });
  }

  operationStatusLabel(status: OperationExecutionStatus | null | undefined): string {
    switch (status) {
      case 'COMPLETED':
        return 'Concluida';
      case 'STARTED':
        return 'Iniciada';
      case 'DELAYED':
        return 'Atrasada';
      default:
        return 'Planeada';
    }
  }

  operationStatusClass(status: OperationExecutionStatus | null | undefined): string {
    switch (status) {
      case 'COMPLETED':
        return 'status-pill success';
      case 'STARTED':
        return 'status-pill warning';
      case 'DELAYED':
        return 'status-pill danger';
      default:
        return 'status-pill neutral';
    }
  }

  isSavingOperation(operationId: number): boolean {
    return this.savingOperations.has(operationId);
  }

  getOperationError(operationId: number): string | null {
    return this.operationErrors.get(operationId) ?? null;
  }

  getOperationSuccess(operationId: number): string | null {
    return this.operationSuccess.get(operationId) ?? null;
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

  private buildOperationsForm(operations: PlannedOperationWithExecution[]): FormGroup {
    const groups = operations.map((operation) =>
      this.fb.group({
        actualStartTime: [this.isoToInput(operation.actualStartTime)],
        actualEndTime: [this.isoToInput(operation.actualEndTime)],
        resourcesUsed: [this.resourcesToText(operation)],
      }),
    );

    return this.fb.group({
      operations: this.fb.array(groups),
    });
  }

  operationsArray(): FormArray {
    if (!this.operationsForm) {
      return this.fb.array([]);
    }
    return this.operationsForm.get('operations') as FormArray;
  }

  private refreshOperationRow(index: number, dto: ExecutedOperationDto): void {
    const current = this.operations[index];
    if (!current) return;

    const updated: PlannedOperationWithExecution = {
      ...current,
      actualStartTime: dto.actualStartTime ?? current.actualStartTime ?? null,
      actualEndTime: dto.actualEndTime ?? current.actualEndTime ?? null,
      actualResourcesUsed: dto.resourcesUsed ?? current.actualResourcesUsed ?? null,
      executionStatus: dto.executionStatus ?? current.executionStatus,
    };

    this.operations[index] = updated;

    const array = this.operationsArray();
    const group = array.at(index) as FormGroup | undefined;
    if (!group) return;

    group.patchValue(
      {
        actualStartTime: this.isoToInput(updated.actualStartTime),
        actualEndTime: this.isoToInput(updated.actualEndTime),
        resourcesUsed: this.resourcesToText(updated),
      },
      { emitEvent: false },
    );

    group.markAsPristine();
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

  private resourcesToText(operation: PlannedOperationWithExecution): string {
    const source =
      operation.actualResourcesUsed ?? this.buildSuggestedResources(operation) ?? null;
    if (!source) return '';
    try {
      return JSON.stringify(source, null, 2);
    } catch {
      return '';
    }
  }

  private buildSuggestedResources(
    operation: PlannedOperationWithExecution,
  ): Record<string, unknown> | null {
    const resources: Record<string, unknown> = {};
    if (operation.craneId) resources['craneId'] = operation.craneId;
    if (operation.storageAreaId) resources['storageAreaId'] = operation.storageAreaId;
    if (operation.staffIds && operation.staffIds.length > 0) {
      resources['staffIds'] = operation.staffIds;
    }
    return Object.keys(resources).length ? resources : null;
  }

  private isoToInput(value?: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num: number) => num.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private inputToIso(value?: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  }

  private normalizeError(err: HttpErrorResponse, fallback: string): string {
    if (err?.error?.message) return err.error.message;
    if (typeof err?.error === 'string') return err.error;
    if (err?.status === 0) return `${fallback} (verifique a rede ou o proxy).`;
    return fallback;
  }
}

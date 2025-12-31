import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap, map } from 'rxjs/operators';
import {
  ExecutedOperationDto,
  OemApiService,
  OperationExecutionStatus,
  PlannedOperationWithExecution,
  UpsertExecutedOperationPayload,
  VesselVisitExecutionListItem,
} from '../oem-api.service';
import { DockDTO } from '../../models/dock';
import { DocksService } from '../../services/docks/docks.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import flatpickr from 'flatpickr';

@Component({
  selector: 'app-vessel-visit-executions-history',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vessel-visit-executions-history.component.html',
  styleUrls: ['./vessel-visit-executions-history.component.scss'],
})
export class VesselVisitExecutionsHistoryComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('dateRangeInput', { static: false })
  dateRangeInput?: ElementRef<HTMLInputElement>;

  filterForm: FormGroup;

  completeForm: FormGroup | null = null;
  completing: VesselVisitExecutionListItem | null = null;

  berthForm: FormGroup | null = null;
  updatingBerth: VesselVisitExecutionListItem | null = null;
  berthError: string | null = null;
  savingBerth = false;
  docks: DockDTO[] = [];
  docksLoading = false;

  operationsTarget: VesselVisitExecutionListItem | null = null;
  operationsForm: FormGroup | null = null;
  operations: PlannedOperationWithExecution[] = [];
  operationsLoading = false;
  operationsError: string | null = null;
  savingOperations = new Set<number>();
  private operationErrors = new Map<number, string>();
  private operationSuccess = new Map<number, string>();

  auditEntries: import('../oem-api.service').VesselVisitExecutionAuditEntry[] = [];
  auditLoading = false;
  auditError: string | null = null;
  auditTarget: VesselVisitExecutionListItem | null = null;

  createForm: FormGroup;
  creating = false;
  createError: string | null = null;

  executions: VesselVisitExecutionListItem[] = [];
  loading = false;
  error: string | null = null;
  emptyMessage: string | null = null;
  displayRange = '';
  private dateRangePicker: flatpickr.Instance | null = null;

  pageSize = 6;
  currentPage = 1;

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
    private readonly docksService: DocksService,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly appRef: ApplicationRef,
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
    this.updateDisplayRangeFromForm();
    this.loadDocks();
    this.fetchExecutions();
  }

  ngAfterViewInit(): void {
    if (!this.dateRangeInput) {
      return;
    }

    const dates = this.getDatesFromForm();

    this.dateRangePicker = flatpickr(this.dateRangeInput.nativeElement, {
      mode: 'range',
      dateFormat: 'Y-m-d',
      defaultDate: dates as Date[],
      onChange: (selectedDates: Date[]) => {
        this.zone.run(() => {
          if (selectedDates.length === 2) {
            this.applySelectedRange(selectedDates[0], selectedDates[1]);
          }
        });
      },
    });
  }

  ngOnDestroy(): void {
    this.dateRangePicker?.destroy();
    this.dateRangePicker = null;
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
    this.updateDisplayRangeFromForm();
    const dates = this.getDatesFromForm();
    if (this.dateRangePicker && dates.length === 2) {
      this.dateRangePicker.setDate(dates as Date[], true);
    } else if (this.dateRangePicker) {
      this.dateRangePicker.clear();
    }
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
    const initial = exec.actualBerthTime ? this.isoToInput(exec.actualBerthTime) : '';
    let datePart = '';
    let timePart = '';
    if (initial) {
      const split = initial.split('T');
      datePart = split[0] ?? '';
      timePart = split[1] ?? '';
    }

    this.berthForm = this.fb.group({
      actualBerthDate: [datePart],
      actualBerthTime: [timePart],
      dockId: [exec.berthId ? String(exec.berthId) : ''],
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
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.zone.run(() => {
            if (error.status === 404) {
              this.operationsError =
                'Esta execucao nao tem um plano de operacoes associado. Registos indisponiveis.';
            } else {
              this.operationsError = this.normalizeError(
                error,
                'Falha ao carregar as operacoes planeadas.',
              );
            }
          });
          return of<PlannedOperationWithExecution[]>([]);
        }),
        switchMap((planned: PlannedOperationWithExecution[] | unknown) => {
          const plannedSafe = Array.isArray(planned) ? planned : [];
          return this.api.getExecutedOperationsForExecution(exec.id).pipe(
            catchError((error: HttpErrorResponse) => {
              this.zone.run(() => {
                this.operationsError = this.normalizeError(
                  error,
                  'Falha ao carregar operacoes executadas.',
                );
              });
              return of<ExecutedOperationDto[]>([]);
            }),
            map((executed: ExecutedOperationDto[]) => ({ planned: plannedSafe, executed })),
          );
        }),
      )
      .subscribe({
        next: ({
          planned,
          executed,
        }: {
          planned: PlannedOperationWithExecution[];
          executed: ExecutedOperationDto[];
        }) => {
          this.zone.run(() => {
            const executedMap = new Map<number, ExecutedOperationDto>();
            executed.forEach((op) => executedMap.set(op.plannedOperationId, op));

            this.operations = planned.map((plan) => {
              const execData = executedMap.get(plan.id) ?? null;
              const status = execData?.executionStatus ?? plan.executionStatus ?? 'PLANNED';
              return {
                ...plan,
                executionStatus: status,
                actualStartTime: execData?.actualStartTime ?? plan.actualStartTime ?? null,
                actualEndTime: execData?.actualEndTime ?? plan.actualEndTime ?? null,
                actualResourcesUsed: execData?.resourcesUsed ?? plan.actualResourcesUsed ?? null,
              };
            });

            this.operationsForm = this.buildOperationsForm(this.operations);
            this.operationsLoading = false;
            this.cdr.detectChanges();
            this.appRef.tick();
          });
        },
        error: (err: HttpErrorResponse) => {
          this.zone.run(() => {
            this.operationsError = this.normalizeError(
              err,
              'Falha ao carregar as operacoes planeadas.',
            );
            this.operationsLoading = false;
            this.cdr.detectChanges();
            this.appRef.tick();
          });
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

  openAudit(exec: VesselVisitExecutionListItem): void {
    this.auditTarget = exec;
    this.auditEntries = [];
    this.auditError = null;
    this.auditLoading = true;

    this.api.getVesselVisitExecutionAudit(exec.id).subscribe({
      next: (entries) => {
        this.auditEntries = entries ?? [];
        this.auditLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.auditError = this.normalizeError(
          err,
          'Falha ao carregar o historico de auditoria.',
        );
        this.auditLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  closeAudit(): void {
    this.auditTarget = null;
    this.auditEntries = [];
    this.auditError = null;
    this.auditLoading = false;
  }

  getAuditAfterField(
    entry: import('../oem-api.service').VesselVisitExecutionAuditEntry,
    key: string,
  ): unknown {
    const after: Record<string, unknown> = (entry?.after as Record<string, unknown>) ?? {};
    return after[key];
  }

  getAuditBeforeField(
    entry: import('../oem-api.service').VesselVisitExecutionAuditEntry,
    key: string,
  ): unknown {
    const before: Record<string, unknown> = (entry?.before as Record<string, unknown>) ?? {};
    return before[key];
  }

  auditActionLabel(action: string): string {
    switch (action) {
      case 'UPDATE_BERTH_DOCK':
        return 'Atualizacao de berth/dock';
      default:
        return action;
    }
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

    if (!raw.actualArrivalTime || Number.isNaN(arrival.getTime())) {
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
      actualBerthDate?: string;
      actualBerthTime?: string;
      dockId?: string;
    };

    const toIso = (value?: string) => {
      if (!value) return '';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString();
    };

    const payload: { actualBerthTime?: string; dockId?: string } = {};

    let combined: string | undefined;
    if (raw.actualBerthDate || raw.actualBerthTime) {
      if (!raw.actualBerthDate || !raw.actualBerthTime) {
        this.berthError = 'Indique a data e a hora de atracacao.';
        return;
      }
      combined = `${raw.actualBerthDate}T${raw.actualBerthTime}`;
    }

    if (combined) {
      const iso = toIso(combined);
      if (!iso) {
        this.berthError = 'Hora de atracacao invalida.';
        return;
      }
      payload.actualBerthTime = iso;
    }

    if (raw.dockId !== undefined && raw.dockId !== null) {
      const dockValue = `${raw.dockId}`.trim();
      if (dockValue) {
        payload.dockId = dockValue;
      }
    }

    if (!payload.actualBerthTime && !payload.dockId) {
      this.berthError = 'Indique pelo menos a hora de atracacao ou o dock usado.';
      return;
    }

    this.savingBerth = true;
    this.berthError = null;

    this.api
      .updateVesselVisitExecution(this.updatingBerth.id, payload)
      .pipe(
        finalize(() => {
          this.zone.run(() => {
            this.savingBerth = false;
            this.cdr.detectChanges();
            this.appRef.tick();
          });
        }),
      )
      .subscribe({
        next: () => {
          this.zone.run(() => {
            this.cancelUpdateBerth();
            this.fetchExecutions();
            this.cdr.detectChanges();
            this.appRef.tick();
          });
        },
        error: (err: HttpErrorResponse) => {
          this.zone.run(() => {
            this.berthError = this.normalizeError(err, 'Falha ao atualizar berth/dock.');
            this.cdr.detectChanges();
            this.appRef.tick();
          });
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
      resourcesCraneId?: string;
      resourcesStorageAreaId?: string;
      resourcesStaffIds?: string;
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

    const resources = this.buildResourcesPayload(raw);
    if (resources) {
      payload.resourcesUsed = resources;
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

  executionVvn(exec: VesselVisitExecutionListItem | null): number | null {
    if (!exec) {
      return null;
    }
    return exec.vesselVisitNotificationId ?? exec.vesselVisitId ?? null;
  }

  trackById(_: number, item: VesselVisitExecutionListItem): number {
    return item.id;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.executions.length / this.pageSize));
  }

  get pagedExecutions(): VesselVisitExecutionListItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.executions.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(1, page), this.totalPages);
    this.currentPage = target;
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
      .subscribe({
        next: (items) => {
          this.zone.run(() => {
            this.executions = items ?? [];
            this.currentPage = 1;
            this.emptyMessage = this.executions.length
              ? null
              : 'Nenhuma execucao encontrada para os filtros aplicados.';
            this.loading = false;
            this.cdr.detectChanges();
            this.appRef.tick();
          });
        },
        error: (err: HttpErrorResponse) => {
          this.zone.run(() => {
            this.executions = [];
            this.error = this.normalizeError(err, 'Falha ao carregar as execucoes.');
            this.loading = false;
            this.cdr.detectChanges();
            this.appRef.tick();
          });
        },
      });
  }

  private buildOperationsForm(operations: PlannedOperationWithExecution[]): FormGroup {
    const groups = operations.map((operation) =>
      this.fb.group({
        actualStartTime: [this.isoToInput(operation.actualStartTime)],
        actualEndTime: [this.isoToInput(operation.actualEndTime)],
        resourcesCraneId: [this.extractResourceValue(operation, 'craneId')],
        resourcesStorageAreaId: [this.extractResourceValue(operation, 'storageAreaId')],
        resourcesStaffIds: [this.extractResourceValue(operation, 'staffIds')],
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
        resourcesCraneId: this.extractResourceValue(updated, 'craneId'),
        resourcesStorageAreaId: this.extractResourceValue(updated, 'storageAreaId'),
        resourcesStaffIds: this.extractResourceValue(updated, 'staffIds'),
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

  private getDatesFromForm(): Date[] {
    const { from, to } = this.filterForm.value;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const result: Date[] = [];
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      result.push(fromDate);
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      result.push(toDate);
    }
    return result;
  }

  private applySelectedRange(start: Date, end: Date): void {
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    this.filterForm.patchValue(
      {
        from: this.toDateInput(startDay),
        to: this.toDateInput(endDay),
      },
      { emitEvent: false },
    );

    this.updateDisplayRange(startDay, endDay);
  }

  private updateDisplayRangeFromForm(): void {
    const dates = this.getDatesFromForm();
    if (dates.length === 2) {
      this.updateDisplayRange(dates[0], dates[1]);
    } else {
      this.displayRange = '';
    }
  }

  private updateDisplayRange(from: Date, to: Date): void {
    const formatter = new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    this.displayRange = `${formatter.format(from)} a ${formatter.format(to)}`;
  }

  private toDateInput(date: Date): string {
    const pad = (v: number) => v.toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    return `${yyyy}-${mm}-${dd}`;
  }

  private extractResourceValue(
    operation: PlannedOperationWithExecution,
    key: 'craneId' | 'storageAreaId' | 'staffIds',
  ): string {
    const raw = operation.actualResourcesUsed;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const value = (raw as Record<string, unknown>)[key];
      if (key === 'staffIds') {
        if (Array.isArray(value)) {
          return value.map((item) => `${item}`).join(', ');
        }
        if (typeof value === 'string') {
          return value;
        }
        return '';
      }
      if (typeof value === 'string') {
        return value;
      }
    }

    if (key === 'staffIds') {
      return operation.staffIds?.length ? operation.staffIds.join(', ') : '';
    }
    return (key === 'craneId' ? operation.craneId : operation.storageAreaId) ?? '';
  }

  private loadDocks(): void {
    this.docksLoading = true;
    this.docksService
      .getAll()
      .then((items) => {
        this.zone.run(() => {
          const sorted = [...(items ?? [])].sort((a, b) => a.id - b.id);
          this.docks = sorted;
          this.docksLoading = false;
          this.cdr.detectChanges();
          this.appRef.tick();
        });
      })
      .catch(() => {
        this.zone.run(() => {
          this.docks = [];
          this.docksLoading = false;
          this.cdr.detectChanges();
          this.appRef.tick();
        });
      });
  }

  private buildResourcesPayload(raw: {
    resourcesCraneId?: string;
    resourcesStorageAreaId?: string;
    resourcesStaffIds?: string;
  }): Record<string, unknown> | undefined {
    const craneId = raw.resourcesCraneId?.trim();
    const storageAreaId = raw.resourcesStorageAreaId?.trim();
    const staffIds = raw.resourcesStaffIds
      ?.split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const payload: Record<string, unknown> = {};
    if (craneId) payload['craneId'] = craneId;
    if (storageAreaId) payload['storageAreaId'] = storageAreaId;
    if (staffIds && staffIds.length) payload['staffIds'] = staffIds;

    return Object.keys(payload).length ? payload : undefined;
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

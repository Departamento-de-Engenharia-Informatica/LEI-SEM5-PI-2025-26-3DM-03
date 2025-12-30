import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { finalize } from 'rxjs/operators';
import {
  ExecutedOperationDto,
  OemApiService,
  OperationExecutionStatus,
  PlannedOperationWithExecution,
  UpsertExecutedOperationPayload,
  VesselVisitExecutionDetail,
} from '../oem-api.service';
import { ToastService } from '../../components/toast/toast.service';
import { AuthService } from '../../services/auth/auth.service';

interface OperationRowView {
  planned: PlannedOperationWithExecution;
  executed: ExecutedOperationDto | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  resourcesUsed: Record<string, unknown> | null;
  status: OperationExecutionStatus;
}

@Component({
  selector: 'app-vessel-visit-execution-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vessel-visit-execution-detail.component.html',
  styleUrls: ['./vessel-visit-execution-detail.component.scss'],
})
export class VesselVisitExecutionDetailComponent implements OnInit, OnDestroy {
  vveId = 0;
  detail: VesselVisitExecutionDetail | null = null;

  loading = true;
  loadError: string | null = null;
  readonlyRowsHint: string | null = null;
  missingPlanMessage: string | null = null;

  operations: OperationRowView[] = [];
  formArray!: FormArray<FormGroup>;

  editingIndex: number | null = null;
  savingOperations = new Set<number>();
  rowErrors = new Map<number, string>();

  private routeSub: Subscription | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly fb: FormBuilder,
    private readonly api: OemApiService,
    private readonly toast: ToastService,
    private readonly auth: AuthService,
  ) {
    this.formArray = this.fb.array<FormGroup>([]);
  }

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      const parsedId = Number(idParam);
      if (!idParam || Number.isNaN(parsedId) || parsedId <= 0) {
        this.loadError = 'Identificador da execucao invalido.';
        this.loading = false;
        return;
      }

      if (this.vveId !== parsedId) {
        this.vveId = parsedId;
        this.fetchExecution(parsedId);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  get canEditRows(): boolean {
    if (!this.detail) return false;
    const status = (this.detail.status ?? '').toLowerCase();
    if (this.auth.isAdmin()) return true;
    const canLogisticsEdit =
      ['in-progress', 'active'].includes(status) && this.auth.hasAny(['logistics-operator']);
    return canLogisticsEdit;
  }

  get rows(): FormArray<FormGroup> {
    return this.formArray;
  }

  isEditing(index: number): boolean {
    return this.editingIndex === index;
  }

  canEditRow(index: number): boolean {
    if (!this.canEditRows) return false;
    if (!this.detail) return false;
    const status = (this.detail.status ?? '').toLowerCase();
    if (status === 'completed' && !this.auth.isAdmin()) {
      return false;
    }
    return true;
  }

  startEdit(index: number): void {
    if (!this.canEditRow(index)) {
      this.readonlyRowsHint = this.buildReadonlyHint();
      return;
    }

    if (this.editingIndex !== null && this.editingIndex !== index) {
      this.cancelEdit(this.editingIndex);
    }

    const group = this.rows.at(index);
    if (!group) return;

    const row = this.operations[index];
    if (!row) return;

    this.applyStatusValidators(group, row);
    this.rowErrors.delete(this.operations[index].planned.id);
    group.enable({ emitEvent: false });
    this.editingIndex = index;
  }

  cancelEdit(index: number): void {
    const group = this.rows.at(index);
    if (!group) return;

    const row = this.operations[index];
    this.patchGroupFromRow(group, row);
    group.markAsPristine();
    group.markAsUntouched();
    group.disable({ emitEvent: false });

    if (this.editingIndex === index) {
      this.editingIndex = null;
    }
  }

  saveRow(index: number): void {
    const group = this.rows.at(index);
    const row = this.operations[index];
    if (!group || !row) return;

    if (!this.canEditRow(index)) {
      this.readonlyRowsHint = this.buildReadonlyHint();
      group.disable({ emitEvent: false });
      return;
    }

    group.markAllAsTouched();
    group.updateValueAndValidity({ emitEvent: false });

    if (group.invalid) {
      if (group.hasError('invalidRange')) {
        this.rowErrors.set(row.planned.id, 'Hora de inicio deve ser anterior a hora de fim.');
      } else if (group.get('actualEndTime')?.hasError('required')) {
        this.rowErrors.set(row.planned.id, 'Hora de fim obrigatoria para operacao concluida.');
      } else {
        this.rowErrors.set(row.planned.id, 'Corrija os erros antes de guardar.');
      }
      return;
    }

    const raw = group.getRawValue() as {
      actualStartTime?: string;
      actualEndTime?: string;
      resourcesUsed?: string;
    };

    const payload: UpsertExecutedOperationPayload = {};

    if (raw.actualStartTime) {
      const iso = this.inputToIso(raw.actualStartTime);
      if (!iso) {
        this.rowErrors.set(row.planned.id, 'Hora de inicio invalida.');
        return;
      }
      payload.actualStartTime = iso;
    }

    if (raw.actualEndTime) {
      const iso = this.inputToIso(raw.actualEndTime);
      if (!iso) {
        this.rowErrors.set(row.planned.id, 'Hora de fim invalida.');
        return;
      }
      payload.actualEndTime = iso;
    }

    if (raw.resourcesUsed && raw.resourcesUsed.trim()) {
      try {
        const parsed = JSON.parse(raw.resourcesUsed.trim());
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          this.rowErrors.set(row.planned.id, 'Recursos devem ser um objeto JSON.');
          return;
        }
        payload.resourcesUsed = parsed as Record<string, unknown>;
      } catch (error) {
        this.rowErrors.set(row.planned.id, 'JSON de recursos invalido.');
        return;
      }
    }

    if (
      payload.actualStartTime === undefined &&
      payload.actualEndTime === undefined &&
      payload.resourcesUsed === undefined
    ) {
      this.rowErrors.set(row.planned.id, 'Indique pelo menos um campo para atualizar.');
      return;
    }

    this.rowErrors.delete(row.planned.id);
    this.savingOperations.add(row.planned.id);

    this.api
      .upsertExecutedOperation(this.vveId, row.planned.id, payload)
      .pipe(
        finalize(() => {
          this.savingOperations.delete(row.planned.id);
        }),
      )
      .subscribe({
        next: (response) => {
          this.toast.success('Operacao guardada com sucesso.');
          this.applyExecutionUpdate(index, response);
          this.editingIndex = null;
        },
        error: (err: HttpErrorResponse) => {
          const message = this.normalizeError(
            err,
            'Falha ao guardar a operacao. Verifique os dados e tente novamente.',
          );
          this.toast.error(message);
          this.rowErrors.set(row.planned.id, message);
        },
      });
  }

  isRowSaving(plannedOperationId: number): boolean {
    return this.savingOperations.has(plannedOperationId);
  }

  displayDateTime(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  statusLabel(status: OperationExecutionStatus | null | undefined): string {
    switch (status) {
      case 'COMPLETED':
        return 'Completed';
      case 'STARTED':
        return 'Started';
      case 'DELAYED':
        return 'Delayed';
      default:
        return 'Planned';
    }
  }

  statusClass(status: OperationExecutionStatus | null | undefined): string {
    switch (status) {
      case 'COMPLETED':
        return 'status-pill completed';
      case 'STARTED':
        return 'status-pill started';
      case 'DELAYED':
        return 'status-pill delayed';
      default:
        return 'status-pill planned';
    }
  }

  executionStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Desconhecido';
    const normalized = status.replace(/[-_]/g, ' ');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  executionStatusClass(status: string | null | undefined): string {
    const normalized = (status ?? '').toLowerCase();
    switch (normalized) {
      case 'completed':
        return 'status-pill completed';
      case 'in-progress':
      case 'active':
        return 'status-pill started';
      case 'cancelled':
        return 'status-pill neutral';
      default:
        return 'status-pill planned';
    }
  }

  resourcesDisplay(value: Record<string, unknown> | null | undefined): string {
    if (!value) return '-';
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return '-';
    }
  }

  trackByOperation(_: number, item: OperationRowView): number {
    return item.planned.id;
  }

  retry(): void {
    if (this.vveId <= 0) {
      this.loadError = 'Identificador da execucao invalido.';
      return;
    }
    this.fetchExecution(this.vveId);
  }

  private fetchExecution(id: number): void {
    this.loading = true;
    this.loadError = null;
    this.readonlyRowsHint = null;
    this.api
      .getVesselVisitExecution(id)
      .pipe(
        switchMap((detail) => {
          this.detail = detail ?? null;
          this.setupReadonlyHint();

          if (!detail?.operationPlanId) {
            this.missingPlanMessage =
              'Esta execucao nao tem um plano de operacoes associado. Registos nao disponiveis.';
            return forkJoin({
              planned: of<PlannedOperationWithExecution[]>([]),
              executed: this.api.getExecutedOperationsForExecution(id),
            });
          }

          this.missingPlanMessage = null;
          return forkJoin({
            planned: this.api.getPlannedOperationsByPlan(detail.operationPlanId).pipe(
              catchError(() => {
                this.missingPlanMessage =
                  'Falha ao carregar o plano de operacoes associado. Tente novamente mais tarde.';
                return of<PlannedOperationWithExecution[]>([]);
              }),
            ),
            executed: this.api.getExecutedOperationsForExecution(id),
          });
        }),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (result) => {
          if (!this.detail) {
            return;
          }

          const plannedTasks = Array.isArray(result?.planned) ? result.planned : [];
          const executedList = Array.isArray(result?.executed) ? result.executed : [];

          this.setupOperations(plannedTasks, executedList);
        },
        error: (err: HttpErrorResponse) => {
          this.loadError = this.normalizeError(
            err,
            'Falha ao carregar os dados da execucao.',
          );
        },
      });
  }

  private setupReadonlyHint(): void {
    if (!this.detail) {
      this.readonlyRowsHint = null;
      return;
    }

    const status = (this.detail.status ?? '').toLowerCase();
    if (status === 'completed' && !this.auth.isAdmin()) {
      this.readonlyRowsHint =
        'Execucao concluida: apenas administradores podem editar as operacoes executadas.';
    } else if (!this.canEditRows) {
      this.readonlyRowsHint = 'Nao possui permissoes para editar esta execucao.';
    } else {
      this.readonlyRowsHint = null;
    }
  }

  private setupOperations(
    planned: PlannedOperationWithExecution[],
    executedList: ExecutedOperationDto[],
  ): void {
    const executedMap = new Map<number, ExecutedOperationDto>();
    (executedList ?? []).forEach((item) => executedMap.set(item.plannedOperationId, item));

    this.operations = planned.map((plan) => {
      const executed = executedMap.get(plan.id) ?? null;
      return {
        planned: plan,
        executed,
        actualStartTime: executed?.actualStartTime ?? plan.actualStartTime ?? null,
        actualEndTime: executed?.actualEndTime ?? plan.actualEndTime ?? null,
        resourcesUsed: executed?.resourcesUsed ?? plan.actualResourcesUsed ?? null,
        status: executed?.executionStatus ?? plan.executionStatus ?? 'PLANNED',
      } as OperationRowView;
    });

    while (this.formArray.length) {
      this.formArray.removeAt(0);
    }

    this.operations.forEach((row) => {
      const group = this.buildOperationGroup(row);
      this.formArray.push(group);
    });
  }

  private buildOperationGroup(row: OperationRowView): FormGroup {
    const group = this.fb.group(
      {
        actualStartTime: [this.toInputValue(row.actualStartTime)],
        actualEndTime: [this.toInputValue(row.actualEndTime)],
        resourcesUsed: [this.stringifyResources(row.resourcesUsed)],
      },
      { validators: VesselVisitExecutionDetailComponent.startBeforeEndValidator },
    );

    if (row.status === 'COMPLETED') {
      group.get('actualEndTime')?.addValidators(Validators.required);
    }

    this.applyStatusValidators(group, row);
    group.disable({ emitEvent: false });
    return group;
  }

  private patchGroupFromRow(group: FormGroup, row: OperationRowView): void {
    group.setValue({
      actualStartTime: this.toInputValue(row.actualStartTime),
      actualEndTime: this.toInputValue(row.actualEndTime),
      resourcesUsed: this.stringifyResources(row.resourcesUsed),
    });
    group.setErrors(null);
    this.applyStatusValidators(group, row);
    group.disable({ emitEvent: false });
  }

  private applyExecutionUpdate(index: number, dto: ExecutedOperationDto): void {
    const row = this.operations[index];
    if (!row) return;

    this.rowErrors.delete(row.planned.id);
    row.executed = dto;
    row.actualStartTime = dto.actualStartTime ?? null;
    row.actualEndTime = dto.actualEndTime ?? null;
    row.resourcesUsed = dto.resourcesUsed ?? null;
    row.status = dto.executionStatus ?? row.status;
    row.planned.executionStatus = row.status;
    row.planned.actualStartTime = row.actualStartTime;
    row.planned.actualEndTime = row.actualEndTime;
    row.planned.actualResourcesUsed = row.resourcesUsed;

    const group = this.rows.at(index);
    if (!group) return;

    this.applyStatusValidators(group, row);
    group.setValue({
      actualStartTime: this.toInputValue(row.actualStartTime),
      actualEndTime: this.toInputValue(row.actualEndTime),
      resourcesUsed: this.stringifyResources(row.resourcesUsed),
    });
    group.markAsPristine();
    group.markAsUntouched();
    group.disable({ emitEvent: false });
  }

  private applyStatusValidators(group: FormGroup, row: OperationRowView): void {
    const endControl = group.get('actualEndTime');
    if (!endControl) return;

    if (row.status === 'COMPLETED') {
      endControl.addValidators(Validators.required);
    } else {
      endControl.removeValidators(Validators.required);
      if (endControl.errors && endControl.hasError('required')) {
        const { required, ...rest } = endControl.errors;
        endControl.setErrors(Object.keys(rest).length ? rest : null);
      }
    }
    endControl.updateValueAndValidity({ emitEvent: false });
  }

  private toInputValue(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private inputToIso(value?: string | null): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  }

  private stringifyResources(value: Record<string, unknown> | null | undefined): string {
    if (!value) return '';
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return '';
    }
  }

  private normalizeError(err: HttpErrorResponse, fallback: string): string {
    if (err.error) {
      if (typeof err.error === 'string' && err.error.trim()) {
        return err.error.trim();
      }
      if (typeof err.error?.message === 'string' && err.error.message.trim()) {
        return err.error.message.trim();
      }
    }
    if (err.message) {
      return err.message;
    }
    return fallback;
  }

  private buildReadonlyHint(): string {
    if (!this.detail) return 'Nao possui permissoes para editar esta execucao.';
    const status = (this.detail.status ?? '').toLowerCase();
    if (status === 'completed' && !this.auth.isAdmin()) {
      return 'Execucao concluida: apenas administradores podem editar as operacoes executadas.';
    }
    if (!this.canEditRows) {
      return 'Nao possui permissoes para editar esta execucao.';
    }
    return 'Edicao nao disponivel para esta operacao.';
  }

  private static startBeforeEndValidator(control: AbstractControl): ValidationErrors | null {
    if (!(control instanceof FormGroup)) return null;
    const startValue = control.get('actualStartTime')?.value as string | null | undefined;
    const endValue = control.get('actualEndTime')?.value as string | null | undefined;
    if (!startValue || !endValue) return null;

    const start = new Date(startValue);
    const end = new Date(endValue);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (start.getTime() >= end.getTime()) {
      return { invalidRange: true };
    }
    return null;
  }
}

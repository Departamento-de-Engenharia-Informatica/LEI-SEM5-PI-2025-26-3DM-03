import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  DailyScheduleRequestPayload,
  DailyScheduleResponse,
  ScheduledOperationDto,
  SchedulingService
} from '../../services/scheduling/scheduling.service';

type VesselFormShape = {
  id: FormControl<string>;
  arrivalHour: FormControl<number>;
  departureHour: FormControl<number>;
  unloadDuration: FormControl<number>;
  loadDuration: FormControl<number>;
};

type CraneFormShape = {
  id: FormControl<string>;
  availableFrom: FormControl<string>;
  availableTo: FormControl<string>;
  capacity: FormControl<number>;
};

type StaffFormShape = {
  id: FormControl<string>;
  skills: FormControl<string>;
  shiftStart: FormControl<string>;
  shiftEnd: FormControl<string>;
};

type VesselFormValue = {
  id: string;
  arrivalHour: number;
  departureHour: number;
  unloadDuration: number;
  loadDuration: number;
};

type CraneFormValue = {
  id: string;
  availableFrom: string;
  availableTo: string;
  capacity: number;
};

type StaffFormValue = {
  id: string;
  skills: string;
  shiftStart: string;
  shiftEnd: string;
};

type AlgorithmOption = 'optimal' | 'prolog' | 'heuristic';

type SchedulingFormShape = {
  date: FormControl<string>;
  algorithm: FormControl<AlgorithmOption>;
  strategy: FormControl<string>;
  vessels: FormArray<FormGroup<VesselFormShape>>;
  cranes: FormArray<FormGroup<CraneFormShape>>;
  staff: FormArray<FormGroup<StaffFormShape>>;
};

interface TimelineSegment {
  vesselId: string;
  startLabel: string;
  endLabel: string;
  delayLabel: string;
  delayed: boolean;
  offsetPercent: number;
  widthPercent: number;
  resourcesLabel: string;
}

interface TimelineView {
  startLabel: string;
  endLabel: string;
  segments: TimelineSegment[];
}

@Component({
  selector: 'app-scheduling',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './scheduling.component.html',
  styleUrls: ['./scheduling.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SchedulingComponent {
  readonly form: FormGroup<SchedulingFormShape>;

  status: 'idle' | 'computing' | 'success' | 'error' = 'idle';
  statusMessage = 'Configure os dados e clique em "Calcular escala diária".';
  errorMessage: string | null = null;
  result: DailyScheduleResponse | null = null;
  warnings: string[] = [];
  timeline: TimelineView | null = null;
  computationMs: number | null = null;
  comparisonLabel: string | null = null;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly schedulingService: SchedulingService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.form = this.createForm();
    this.useSampleData();
  }

  get vessels(): FormArray<FormGroup<VesselFormShape>> {
    return this.form.controls.vessels;
  }

  get cranes(): FormArray<FormGroup<CraneFormShape>> {
    return this.form.controls.cranes;
  }

  get staff(): FormArray<FormGroup<StaffFormShape>> {
    return this.form.controls.staff;
  }

  addVesselRow(initial?: Partial<VesselFormValue>): void {
    this.vessels.push(
      this.fb.group({
        id: this.fb.control(initial?.id ?? '', { validators: [Validators.required] }),
        arrivalHour: this.fb.control(initial?.arrivalHour ?? 0, { validators: [Validators.min(0)] }),
        departureHour: this.fb.control(initial?.departureHour ?? 24, { validators: [Validators.min(0)] }),
        unloadDuration: this.fb.control(initial?.unloadDuration ?? 4, { validators: [Validators.min(1)] }),
        loadDuration: this.fb.control(initial?.loadDuration ?? 4, { validators: [Validators.min(0)] })
      })
    );
  }

  addCraneRow(initial?: Partial<CraneFormValue>): void {
    this.cranes.push(
      this.fb.group({
        id: this.fb.control(initial?.id ?? ''),
        availableFrom: this.fb.control(initial?.availableFrom ?? '06:00'),
        availableTo: this.fb.control(initial?.availableTo ?? '18:00'),
        capacity: this.fb.control(initial?.capacity ?? 1, { validators: [Validators.min(1)] })
      })
    );
  }

  addStaffRow(initial?: Partial<StaffFormValue>): void {
    this.staff.push(
      this.fb.group({
        id: this.fb.control(initial?.id ?? ''),
        skills: this.fb.control(initial?.skills ?? ''),
        shiftStart: this.fb.control(initial?.shiftStart ?? '06:00'),
        shiftEnd: this.fb.control(initial?.shiftEnd ?? '14:00')
      })
    );
  }

  removeVessel(index: number): void {
    this.vessels.removeAt(index);
  }

  removeCrane(index: number): void {
    this.cranes.removeAt(index);
  }

  removeStaff(index: number): void {
    this.staff.removeAt(index);
  }

  useSampleData(): void {
    this.vessels.clear();
    [
      { id: 'va', arrivalHour: 6, departureHour: 63, unloadDuration: 10, loadDuration: 16 },
      { id: 'vb', arrivalHour: 3, departureHour: 48, unloadDuration: 6, loadDuration: 8 },
      { id: 'vc', arrivalHour: 12, departureHour: 72, unloadDuration: 5, loadDuration: 6 }
    ].forEach(v => this.addVesselRow(v));

    this.cranes.clear();
    [
      { id: 'CR-1', availableFrom: '06:00', availableTo: '18:00', capacity: 1 },
      { id: 'CR-2', availableFrom: '18:00', availableTo: '23:59', capacity: 1 }
    ].forEach(c => this.addCraneRow(c));

    this.staff.clear();
    [
      { id: 'ST-1', skills: 'crane,logistics', shiftStart: '06:00', shiftEnd: '14:00' },
      { id: 'ST-2', skills: 'logistics', shiftStart: '14:00', shiftEnd: '22:00' }
    ].forEach(s => this.addStaffRow(s));

    this.status = 'idle';
    this.statusMessage = 'Dados de exemplo carregados.';
    this.result = null;
    this.timeline = null;
    this.warnings = [];
    this.errorMessage = null;
    this.comparisonLabel = null;
    this.cdr.markForCheck();
  }

  async generateSchedule(): Promise<void> {
    if (this.vessels.length === 0) {
      this.errorMessage = 'Adicione pelo menos um navio antes de calcular.';
      this.status = 'error';
      this.statusMessage = 'Faltam navios.';
      this.cdr.markForCheck();
      return;
    }

    this.status = 'computing';
    this.statusMessage = 'A calcular plano diário...';
    this.errorMessage = null;
    this.result = null;
    this.timeline = null;
    this.warnings = [];
    this.computationMs = null;
    this.comparisonLabel = null;
    this.cdr.markForCheck();

    const date = this.form.controls.date.value;
    const algorithm = this.form.controls.algorithm.value;
    const startedAt = performance.now();

    const payload: DailyScheduleRequestPayload = {
      date,
      strategy: this.form.controls.strategy.value || undefined,
      vessels: this.vessels.controls
        .map(ctrl => ({
          id: ctrl.controls.id.value.trim(),
          arrivalHour: Number(ctrl.controls.arrivalHour.value ?? 0),
          departureHour: Number(ctrl.controls.departureHour.value ?? 0),
          unloadDuration: Number(ctrl.controls.unloadDuration.value ?? 0),
          loadDuration: Number(ctrl.controls.loadDuration.value ?? 0)
        }))
        .filter(v => v.id),
      cranes: this.cranes.controls
        .map(ctrl => {
          const id = ctrl.controls.id.value.trim();
          if (!id) return null;
          return {
            id,
            availableFrom: this.composeIso(date, ctrl.controls.availableFrom.value),
            availableTo: this.composeIso(date, ctrl.controls.availableTo.value),
            capacity: Number(ctrl.controls.capacity.value || 1)
          };
        })
        .filter((c): c is NonNullable<typeof c> => !!c),
      staff: this.staff.controls
        .map(ctrl => {
          const id = ctrl.controls.id.value.trim();
          if (!id) return null;
          return {
            id,
            skills: (ctrl.controls.skills.value || '')
              .split(',')
              .map(skill => skill.trim())
              .filter(Boolean),
            shiftStart: this.composeIso(date, ctrl.controls.shiftStart.value),
            shiftEnd: this.composeIso(date, ctrl.controls.shiftEnd.value)
          };
        })
        .filter((s): s is NonNullable<typeof s> => !!s)
    };

    try {
      const response = await this.schedulingService.generateDailySchedule(payload, algorithm);
      this.result = response;
      this.timeline = this.buildTimeline(response.schedule);
      this.warnings = response.warnings ?? [];
      this.comparisonLabel = response.comparison
        ? `Comparado com ${response.comparison.baseline.algorithm}`
        : null;
      this.status = 'success';
      this.statusMessage = 'Plano diário gerado com sucesso.';
      this.errorMessage = null;
      this.computationMs = response.computationMilliseconds || Math.round(performance.now() - startedAt);
    } catch (error: any) {
      console.error('Scheduling failed', error);
      this.errorMessage = error?.message ?? 'Falha ao gerar o plano.';
      this.status = 'error';
      this.statusMessage = 'Falha no cálculo.';
    } finally {
      this.cdr.markForCheck();
    }
  }

  trackByIndex(_: number, item: unknown): unknown {
    return item;
  }

  formatTime(value: string): string {
    const date = new Date(value);
    return `${this.pad(date.getHours())}:${this.pad(date.getMinutes())}`;
  }

  operationDurationMinutes(operation: ScheduledOperationDto): number {
    const diff = new Date(operation.endTime).getTime() - new Date(operation.startTime).getTime();
    return Math.max(0, Math.round(diff / 60000));
  }

  private todayIso(): string {
    const now = new Date();
    return `${now.getFullYear()}-${this.pad(now.getMonth() + 1)}-${this.pad(now.getDate())}`;
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  private composeIso(date: string, time: string): string {
    const safeTime = time && time.length >= 4 ? time : '00:00';
    return new Date(`${date}T${safeTime}:00`).toISOString();
  }

  private createForm(): FormGroup<SchedulingFormShape> {
    return this.fb.group({
      date: this.fb.control(this.todayIso(), { validators: [Validators.required] }),
      algorithm: this.fb.control<AlgorithmOption>('optimal', { validators: [Validators.required] }),
      strategy: this.fb.control('default'),
      vessels: this.fb.array<FormGroup<VesselFormShape>>([]),
      cranes: this.fb.array<FormGroup<CraneFormShape>>([]),
      staff: this.fb.array<FormGroup<StaffFormShape>>([])
    });
  }

  private buildTimeline(schedule: ScheduledOperationDto[]): TimelineView | null {
    if (!schedule || schedule.length === 0) {
      return null;
    }

    const sorted = [...schedule].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    const first = new Date(sorted[0].startTime).getTime();
    const last = new Date(sorted[sorted.length - 1].endTime).getTime();
    const total = Math.max(last - first, 1);

    return {
      startLabel: this.formatTime(sorted[0].startTime),
      endLabel: this.formatTime(sorted[sorted.length - 1].endTime),
      segments: sorted.map(operation => {
        const start = new Date(operation.startTime).getTime();
        const end = new Date(operation.endTime).getTime();
        const offsetPercent = ((start - first) / total) * 100;
        const widthPercent = ((end - start) / total) * 100;
        return {
          vesselId: operation.vesselId,
          startLabel: this.formatTime(operation.startTime),
          endLabel: this.formatTime(operation.endTime),
          delayLabel: operation.delayMinutes > 0 ? `${operation.delayMinutes} min atraso` : 'A tempo',
          delayed: operation.delayMinutes > 0,
          offsetPercent,
          widthPercent,
          resourcesLabel: [...operation.craneIds, ...operation.staffIds].join(', ')
        };
      })
    };
  }
}

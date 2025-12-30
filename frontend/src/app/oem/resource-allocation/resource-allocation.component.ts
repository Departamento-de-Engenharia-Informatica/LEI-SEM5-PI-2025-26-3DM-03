import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, NgZone } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  OemApiService,
  ResourceAllocationSummaryDto,
  ResourceAllocationResourceType,
} from '../oem-api.service';
import { DocksService } from '../../services/docks/docks.service';
import { DockDTO } from '../../models/dock';
import { ResourcesService } from '../../services/resources/resources.service';
import { ResourceDTO } from '../../models/resource';
import { StaffService } from '../../services/staff/staff.service';
import { StaffDTO } from '../../models/staff';

type AllocationRow = ResourceAllocationSummaryDto;
// eslint-disable-next-line @typescript-eslint/no-var-requires
import flatpickr from 'flatpickr';

@Component({
  selector: 'app-oem-resource-allocation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './resource-allocation.component.html',
  styleUrls: ['./resource-allocation.component.scss'],
})
export class ResourceAllocationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('dateRangeInput', { static: false })
  dateRangeInput?: ElementRef<HTMLInputElement>;

  form: FormGroup;
  results: AllocationRow[] = [];
  loading = false;
  error: string | null = null;
  emptyMessage: string | null = null;
  docks: DockDTO[] = [];
  docksLoading = false;
  docksError: string | null = null;
  cranes: ResourceDTO[] = [];
  cranesLoading = false;
  cranesError: string | null = null;
  staff: StaffDTO[] = [];
  staffLoading = false;
  staffError: string | null = null;

  private dateRangePicker: flatpickr.Instance | null = null;
  displayRange = '';

  readonly resourceTypes: { id: ResourceAllocationResourceType; label: string }[] = [
    { id: 'crane', label: 'Crane' },
    { id: 'dock', label: 'Dock' },
    { id: 'staff', label: 'Staff' },
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: OemApiService,
    private readonly zone: NgZone,
    private readonly docksService: DocksService,
    private readonly resourcesService: ResourcesService,
    private readonly staffService: StaffService,
  ) {
    this.form = this.fb.group({
      from: [this.defaultFrom(), Validators.required],
      to: [this.defaultTo(), Validators.required],
      resourceType: ['crane', Validators.required],
      resourceId: [''],
    });

    // Ao abrir a página, se o tipo for grua, carrega logo as gruas
    if (this.form.value.resourceType === 'crane') {
      this.ensureCranesLoaded();
    }
  }

  ngOnInit(): void {
    // Carrega resultados iniciais para o intervalo por defeito
    this.updateDisplayRangeFromForm();
    this.onSearch();
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

  get fromControl() {
    return this.form.get('from');
  }

  get toControl() {
    return this.form.get('to');
  }

  onSearch(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { from, to, resourceType, resourceId } = this.form.value;
    const fromIso = this.toIsoString(from);
    const toIso = this.toIsoString(to);

    if (!fromIso || !toIso) {
      this.error = 'Datas invalidas. Verifique o intervalo selecionado.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.emptyMessage = null;

    this.api
      .getResourceAllocation({
        from: fromIso,
        to: toIso,
        resourceType,
        resourceId: resourceId?.trim() || undefined,
      })
      .subscribe({
        next: (data: ResourceAllocationSummaryDto[]) => {
          this.zone.run(() => {
            this.results = data ?? [];
            this.emptyMessage = this.results.length
              ? null
              : 'Sem resultados para o periodo selecionado.';
            this.loading = false;
          });
        },
        error: (err: HttpErrorResponse) => {
          this.zone.run(() => {
            this.results = [];
            this.error = this.normalizeError(
              err,
              'Falha ao carregar a alocacao de recursos.',
            );
            this.loading = false;
          });
        },
      });
  }

  onResourceTypeChange(): void {
    this.form.patchValue({ resourceId: '' });
    if (this.form.value.resourceType === 'dock') {
      this.ensureDocksLoaded();
    } else if (this.form.value.resourceType === 'crane') {
      this.ensureCranesLoaded();
    } else if (this.form.value.resourceType === 'staff') {
      this.ensureStaffLoaded();
    }
  }

  reset(): void {
    this.form.reset({
      from: this.defaultFrom(),
      to: this.defaultTo(),
      resourceType: 'crane',
      resourceId: '',
    });
    this.results = [];
    this.error = null;
    this.emptyMessage = null;
    this.updateDisplayRangeFromForm();
    const dates = this.getDatesFromForm();
    if (this.dateRangePicker && dates.length === 2) {
      this.dateRangePicker.setDate(dates as Date[], true);
    }
  }

  private toIsoString(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private defaultFrom(): string {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    return this.toLocalInput(start);
  }

  private defaultTo(): string {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0);
    return this.toLocalInput(end);
  }

  private toLocalInput(date: Date): string {
    const pad = (v: number) => v.toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mi = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  private getDatesFromForm(): Date[] {
    const { from, to } = this.form.value;
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
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 0);

    this.form.patchValue(
      {
        from: this.toLocalInput(startDay),
        to: this.toLocalInput(endDay),
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
    this.displayRange = `${formatter.format(from)} · ${formatter.format(to)}`;
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

  private ensureDocksLoaded(): void {
    if (this.docksLoading || this.docks.length > 0) {
      return;
    }
    this.docksLoading = true;
    this.docksError = null;
    this.docksService
      .getAll()
      .then((data) => {
        this.zone.run(() => {
          this.docks = data ?? [];
        });
      })
      .catch(() => {
        this.zone.run(() => {
          this.docksError = 'Falha ao carregar docas.';
          this.docks = [];
        });
      })
      .finally(() => {
        this.zone.run(() => {
          this.docksLoading = false;
        });
      });
  }

  private ensureCranesLoaded(): void {
    if (this.cranesLoading || this.cranes.length > 0) {
      return;
    }
    this.cranesLoading = true;
    this.cranesError = null;
    this.resourcesService
      .getAll()
      .then((all) => {
        this.zone.run(() => {
          const list = Array.isArray(all) ? all : [];
          this.cranes = list.filter(r => (r.type ?? '').toLowerCase().includes('crane'));
        });
      })
      .catch(() => {
        this.zone.run(() => {
          this.cranesError = 'Falha ao carregar gruas.';
          this.cranes = [];
        });
      })
      .finally(() => {
        this.zone.run(() => {
          this.cranesLoading = false;
        });
      });
  }

  private ensureStaffLoaded(): void {
    if (this.staffLoading || this.staff.length > 0) {
      return;
    }
    this.staffLoading = true;
    this.staffError = null;
    this.staffService
      .getAll()
      .then((all) => {
        this.zone.run(() => {
          this.staff = all ?? [];
        });
      })
      .catch(() => {
        this.zone.run(() => {
          this.staffError = 'Falha ao carregar staff.';
          this.staff = [];
        });
      })
      .finally(() => {
        this.zone.run(() => {
          this.staffLoading = false;
        });
      });
  }
}

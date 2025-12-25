import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';
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

@Component({
  selector: 'app-oem-resource-allocation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './resource-allocation.component.html',
  styleUrls: ['./resource-allocation.component.scss'],
})
export class ResourceAllocationComponent {
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

  readonly resourceTypes: { id: ResourceAllocationResourceType; label: string }[] = [
    { id: 'crane', label: 'Crane' },
    { id: 'dock', label: 'Dock' },
    { id: 'staff', label: 'Staff' },
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: OemApiService,
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
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (data: ResourceAllocationSummaryDto[]) => {
          this.results = data ?? [];
          this.emptyMessage = this.results.length
            ? null
            : 'Sem resultados para o periodo selecionado.';
        },
        error: (err: HttpErrorResponse) => {
          this.results = [];
          this.error = this.normalizeError(
            err,
            'Falha ao carregar a alocacao de recursos.',
          );
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
        this.docks = data ?? [];
      })
      .catch(() => {
        this.docksError = 'Falha ao carregar docas.';
        this.docks = [];
      })
      .finally(() => {
        this.docksLoading = false;
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
        const list = Array.isArray(all) ? all : [];
        this.cranes = list.filter(r => (r.type ?? '').toLowerCase().includes('crane'));
      })
      .catch(() => {
        this.cranesError = 'Falha ao carregar gruas.';
        this.cranes = [];
      })
      .finally(() => {
        this.cranesLoading = false;
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
        this.staff = all ?? [];
      })
      .catch(() => {
        this.staffError = 'Falha ao carregar staff.';
        this.staff = [];
      })
      .finally(() => {
        this.staffLoading = false;
      });
  }
}

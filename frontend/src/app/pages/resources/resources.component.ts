import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/i18n/translate.mock.module';
import { ResourcesService } from '../../services/resources/resources.service';
import { ResourceDTO, CreateResourceDTO, UpdateResourceDTO } from '../../models/resource';
import { QualificationsService } from '../../services/qualifications/qualifications.service';
import { Qualification } from '../../models/qualification';

type SortKey = 'code' | 'type' | 'status';
type ResourceFormModel = ResourceDTO;

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './resources.component.html',
  styleUrls: ['./resources.component.scss']
})
export class ResourcesComponent implements OnInit {
  resources: ResourceDTO[] = [];
  filtered: ResourceDTO[] = [];
  availableQualifications: Qualification[] = [];
  loading = false;
  error: string | null = null;

  readonly typeOptionsBase = ['MobileCrane', 'FixedCrane', 'Truck'];
  typeOptions: string[] = [...this.typeOptionsBase];

  q = '';
  sortKey: SortKey = 'code';
  sortDir: 'asc' | 'desc' = 'asc';

  showForm = false;
  isEditing = false;
  formError: string | null = null;
  successMessage: string | null = null;
  currentResource: ResourceFormModel | null = null;
  selectedQualification: string = '';

  saving = false;
  removingCodes: Set<string> = new Set();

  constructor(
    private svc: ResourcesService,
    private qualificationsService: QualificationsService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await Promise.all([this.load(), this.loadQualifications()]);
  }

  async load() {
    this.loading = true;
    this.error = null;
    try {
      this.resources = await this.svc.getAll();
      this.applyFilterSort();
    } catch (e: any) {
      this.error = e?.message || 'Erro ao carregar recursos';
    } finally {
      this.loading = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  applyFilterSort() {
    const q = this.q.trim().toLowerCase();
    let arr = this.resources.slice();
    if (q) {
      arr = arr.filter(r =>
        (r.code ?? '').toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.type ?? '').toLowerCase().includes(q) ||
        (r.status ?? '').toLowerCase().includes(q) ||
        (r.assignedArea ?? '').toLowerCase().includes(q) ||
        (r.requiredQualifications ?? []).some(code => code.toLowerCase().includes(q))
      );
    }
    const dir = this.sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = (a[this.sortKey] as any) ?? '';
      const vb = (b[this.sortKey] as any) ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
    this.filtered = arr;
    try { this.cdr.detectChanges(); } catch {}
  }

  clearSearch() {
    this.q = '';
    this.applyFilterSort();
  }

  isActiveStatus(status?: string | null) {
    const s = (status ?? '').toString().trim().toUpperCase();
    return s === 'OPERATIONAL' || s === 'ACTIVE';
  }

  changeSort(key: SortKey) {
    if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortKey = key; this.sortDir = 'asc'; }
    this.applyFilterSort();
  }

  newResourceForm() {
    this.currentResource = this.createEmptyResource();
    this.formError = null;
    this.isEditing = false;
    this.showForm = true;
    this.selectedQualification = '';
  }

  onCreateClick() {
    this.newResourceForm();
  }

  editResource(resource: ResourceDTO) {
    const qualifications = Array.isArray(resource.requiredQualifications) ? resource.requiredQualifications : [];
    const normalizedType = this.ensureTypeIsAvailable(resource.type);
    this.currentResource = {
      ...(resource || {}),
      type: normalizedType,
      requiredQualifications: this.sanitizeQualificationCodes(qualifications)
    };
    this.isEditing = true;
    this.formError = null;
    this.showForm = true;
    this.selectedQualification = '';
  }

  cancel() {
    this.currentResource = null;
    this.showForm = false;
    this.formError = null;
  }

  private normalizeOptional(value: any): string | null {
    const trimmed = (value ?? '').toString().trim();
    return trimmed.length ? trimmed : null;
  }

  private createEmptyResource(): ResourceFormModel {
    return {
      code: '',
      description: '',
      type: this.typeOptions[0] ?? '',
      status: 'Active',
      operationalCapacity: 1,
      assignedArea: null,
      setupTimeMinutes: null,
      requiredQualifications: [],
    };
  }

  private ensureTypeIsAvailable(type: string | null | undefined): string {
    const normalized = (type ?? '').trim();
    if (!normalized) {
      return this.typeOptions[0] ?? '';
    }
    if (!this.typeOptions.includes(normalized)) {
      this.typeOptions = [...this.typeOptions, normalized];
    }
    return normalized;
  }

  private sanitizeQualificationCodes(codes: string[] | undefined): string[] {
    return (codes ?? [])
      .map(code => (code ?? '').trim().toUpperCase())
      .filter(code => !!code)
      .filter((code, index, arr) => arr.indexOf(code) === index);
  }

  onQualificationSelected(value: string) {
    if (!this.currentResource) return;
    const normalized = (value ?? '').trim().toUpperCase();
    if (!normalized) return;
    const current = new Set(this.currentResource.requiredQualifications ?? []);
    if (!current.has(normalized)) {
      current.add(normalized);
      this.currentResource.requiredQualifications = Array.from(current);
    }
    this.selectedQualification = '';
  }

  removeQualification(code: string) {
    if (!this.currentResource) return;
    this.currentResource.requiredQualifications = (this.currentResource.requiredQualifications ?? [])
      .filter(item => item !== code);
  }

  private normalizeAssignedArea(value: any): string | null | false {
    const trimmed = this.normalizeOptional(value);
    if (!trimmed) return null;
    const pattern = /^[A-Za-z0-9 ]{2,20}$/;
    if (!pattern.test(trimmed)) return false;
    return trimmed;
  }

  async save() {
    if (!this.currentResource) return;
    this.formError = null;
    const code = (this.currentResource.code ?? '').toString().trim();
    const description = (this.currentResource.description ?? '').toString().trim();
    const type = (this.currentResource.type ?? '').toString().trim();
    const status = (this.currentResource.status ?? '').toString().trim() || 'Active';
    const operationalCapacity = Number(this.currentResource.operationalCapacity ?? 0);
    const setupValue = this.currentResource.setupTimeMinutes as unknown as number | string | null | undefined;
    const setupTimeMinutes = setupValue === null || setupValue === undefined || setupValue === '' ? null : Number(setupValue);
    const requiredQualifications = this.sanitizeQualificationCodes(this.currentResource.requiredQualifications);

    const codePattern = /^[A-Za-z0-9-_]{2,20}$/;
    if (!codePattern.test(code)) {
      this.formError = 'Code must be 2-20 characters, alphanumeric with optional hyphen or underscore.';
      return;
    }
    if (!this.isEditing && this.resources.some(r => (r.code ?? '').toLowerCase() === code.toLowerCase())) {
      this.formError = 'A resource with this code already exists.';
      return;
    }

    if (description.length < 3 || description.length > 100) {
      this.formError = 'Description must be between 3 and 100 characters.';
      return;
    }

    if (!this.typeOptions.includes(type)) {
      this.formError = 'Select a valid resource type.';
      return;
    }

    if (!Number.isInteger(setupTimeMinutes) || setupTimeMinutes === null || setupTimeMinutes < 0 || setupTimeMinutes > 1440) {
      this.formError = 'Setup time must be an integer between 0 and 1440 minutes.';
      return;
    }

    if (!Number.isInteger(operationalCapacity) || operationalCapacity < 1) {
      this.formError = 'Capacity must be an integer of at least 1.';
      return;
    }
    const assignedArea = this.normalizeAssignedArea(this.currentResource.assignedArea);
    if (assignedArea === false) {
      this.formError = 'Assigned area must be 2-20 alphanumeric characters.';
      return;
    }
    const assignedAreaValue = assignedArea || null;

    this.currentResource.requiredQualifications = requiredQualifications;
    this.saving = true;

    try {
      if (this.isEditing) {
        const dto: UpdateResourceDTO = {
          description,
          type,
          operationalCapacity,
          status,
          assignedArea: assignedAreaValue,
          setupTimeMinutes,
          requiredQualifications
        };
        await this.svc.update(code, dto);
        this.successMessage = 'Resource updated successfully.';
      } else {
        const payload: CreateResourceDTO = {
          code,
          description,
          type,
          operationalCapacity,
          status,
          assignedArea: assignedAreaValue,
          setupTimeMinutes,
          requiredQualifications
        };
        const created = await this.svc.create(payload);
        this.resources.unshift(created);
        this.successMessage = 'Resource created successfully.';
      }

      await this.load();
      this.showForm = false;
      try { this.cdr.detectChanges(); } catch {}

      setTimeout(() => {
        this.successMessage = null;
        try { this.cdr.detectChanges(); } catch {}
      }, 3000);
    } catch (err: any) {
      this.formError = err?.message ?? 'Save failed';
    } finally {
      this.saving = false;
    }
  }

  onSaveClick() {
    if (this.saving) return;
    setTimeout(() => this.save(), 0);
  }

  private async loadQualifications() {
    try {
      this.availableQualifications = await this.qualificationsService.getAll();
    } catch (err) {
      console.error('Error loading qualifications for picker', err);
      this.availableQualifications = [];
    } finally {
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  async remove(resource: ResourceDTO) {
    const code = resource.code;
    if (!code) return;
    if (this.removingCodes.has(code)) return;
    if (!confirm(`Remove resource ${code}?`)) return;
    this.removingCodes.add(code);

    const idx = this.resources.findIndex(x => x.code === code);
    let backup: ResourceDTO | null = null;
    if (idx >= 0) {
      backup = this.resources[idx];
      this.resources.splice(idx, 1);
      this.applyFilterSort();
      try { this.cdr.detectChanges(); } catch {}
    }

    let fullyDeleted = false;
    try {
      await this.svc.delete(code);
      fullyDeleted = true;
    } catch {
      try {
        await this.svc.deactivate(code);
        this.error = 'Resource could not be deleted, so it was deactivated instead.';
      } catch (fallbackError: any) {
        const msg = fallbackError?.message ?? '';
        if (backup) {
          this.resources.splice(idx >= 0 ? idx : 0, 0, backup);
          this.applyFilterSort();
          try { this.cdr.detectChanges(); } catch {}
        }
        this.error = msg || 'Erro ao remover recurso';
      }
    } finally {
      this.removingCodes.delete(code);
    }

    await this.load();
  }
}

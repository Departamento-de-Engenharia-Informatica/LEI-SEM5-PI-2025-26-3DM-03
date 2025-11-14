import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/i18n/translate.mock.module';
import { StaffService } from '../../services/staff/staff.service';
import { CreateStaffDTO, StaffDTO, UpdateStaffDTO } from '../../models/staff';
import { ToastService } from '../../components/toast/toast.service';
import { TranslationService } from '../../services/i18n/translation.service';

type SortKey = 'mecanographicNumber' | 'shortName' | 'email' | 'phoneNumber' | 'status' | 'active';
type ServerFilterKey = 'all' | 'mecanographic' | 'name' | 'status' | 'qualification' | 'active';
type StatusFilter = 'all' | 'active' | 'inactive';

interface StaffCreateForm {
  mecanographicNumber: string;
  shortName: string;
  email: string;
  phoneNumber: string;
  startTime: string;
  endTime: string;
  qualifications: string;
}

interface StaffEditForm {
  shortName: string;
  email: string;
  phoneNumber: string;
  startTime: string;
  endTime: string;
  status: string;
  active: boolean;
  qualifications: string;
}

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './staff.component.html',
  styleUrls: ['./staff.component.scss']
})
export class StaffComponent implements OnInit {
  staff: StaffDTO[] = [];
  filtered: StaffDTO[] = [];

  loading = false;
  error: string | null = null;

  searchServer = '';
  serverFilter: ServerFilterKey = 'all';
  localQuery = '';
  statusFilter: StatusFilter = 'all';
  sortKey: SortKey = 'mecanographicNumber';
  sortDir: 'asc' | 'desc' = 'asc';

  createForm: StaffCreateForm = this.blankCreateForm();
  editForm: StaffEditForm = this.blankEditForm();
  createError: string | null = null;
  editError: string | null = null;
  editing: StaffDTO | null = null;

  creating = false;
  saving = false;
  rowBusy = new Set<string>();

  constructor(
    private svc: StaffService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private i18n: TranslationService
  ) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading = true;
    this.error = null;
    try {
      this.staff = await this.svc.getAll(this.searchServer, this.serverFilter);
      this.applyFilters();
    } catch (e: any) {
      this.error = e?.message || this.i18n.t('staff.errors.load');
    } finally {
      this.loading = false;
      try {
        this.cdr.detectChanges();
      } catch {}
    }
  }

  applyFilters() {
    let arr = this.staff.slice();
    const q = this.localQuery.trim().toLowerCase();
    if (q) {
      arr = arr.filter(s =>
        (s.mecanographicNumber ?? '').toLowerCase().includes(q) ||
        (s.shortName ?? '').toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q) ||
        (s.phoneNumber ?? '').toLowerCase().includes(q) ||
        (s.status ?? '').toLowerCase().includes(q) ||
        (s.qualifications ?? []).some(code => code?.toLowerCase().includes(q))
      );
    }

    if (this.statusFilter !== 'all') {
      arr = arr.filter(s => (this.statusFilter === 'active') === Boolean(s.active));
    }

    const dir = this.sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = this.sortValue(a, this.sortKey);
      const vb = this.sortValue(b, this.sortKey);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });

    this.filtered = arr;
    try {
      this.cdr.detectChanges();
    } catch {}
  }

  private sortValue(s: StaffDTO, key: SortKey) {
    switch (key) {
      case 'active':
        return s.active ? 1 : 0;
      default:
        return (s[key] as any) ?? '';
    }
  }

  changeSort(key: SortKey) {
    if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.applyFilters();
  }

  sortIconClass(key: SortKey) {
    if (this.sortKey !== key) return 'bi bi-arrow-down-up';
    return this.sortDir === 'asc' ? 'bi bi-arrow-down-short' : 'bi bi-arrow-up-short';
  }

  private blankCreateForm(): StaffCreateForm {
    return {
      mecanographicNumber: '',
      shortName: '',
      email: '',
      phoneNumber: '',
      startTime: '',
      endTime: '',
      qualifications: ''
    };
  }

  private blankEditForm(): StaffEditForm {
    return {
      shortName: '',
      email: '',
      phoneNumber: '',
      startTime: '',
      endTime: '',
      status: 'Available',
      active: true,
      qualifications: ''
    };
  }

  private normalizeTime(value: string): string | null {
    const trimmed = (value || '').trim();
    if (!trimmed) return null;
    if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      const [hh, mm] = trimmed.split(':');
      return `${hh.padStart(2, '0')}:${mm}:00`;
    }
    return trimmed;
  }

  private timeForInput(value?: string | null): string {
    if (!value) return '';
    const parts = value.split(':');
    if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    return value;
  }

  private parseQualifications(text: string) {
    return (text || '')
      .split(/[,;\n]/)
      .map(x => x.trim())
      .filter(Boolean);
  }

  async create() {
    if (this.creating) return;
    this.createError = null;
    const payload: CreateStaffDTO = {
      mecanographicNumber: this.createForm.mecanographicNumber.trim(),
      shortName: this.createForm.shortName.trim(),
      email: this.createForm.email.trim(),
      phoneNumber: this.createForm.phoneNumber.trim(),
      startTime: this.normalizeTime(this.createForm.startTime),
      endTime: this.normalizeTime(this.createForm.endTime),
      qualifications: this.parseQualifications(this.createForm.qualifications)
    };

    if (!payload.mecanographicNumber || !payload.shortName) {
      this.createError = this.i18n.t('staff.errors.invalidForm');
      return;
    }

    this.creating = true;
    try {
      const created = await this.svc.create(payload);
      this.staff.unshift(created);
      this.createForm = this.blankCreateForm();
      this.applyFilters();
      this.toast.success(this.i18n.t('staff.toasts.created'));
    } catch (e: any) {
      this.createError = e?.message || this.i18n.t('staff.errors.create');
    } finally {
      this.creating = false;
      try {
        this.cdr.detectChanges();
      } catch {}
    }
  }

  openEdit(entry: StaffDTO) {
    this.editing = { ...entry };
    this.editForm = {
      shortName: entry.shortName ?? '',
      email: entry.email ?? '',
      phoneNumber: entry.phoneNumber ?? '',
      startTime: this.timeForInput(entry.startTime),
      endTime: this.timeForInput(entry.endTime),
      status: entry.status ?? 'Available',
      active: Boolean(entry.active),
      qualifications: (entry.qualifications ?? []).join(', ')
    };
    this.editError = null;
  }

  closeEdit() {
    this.editing = null;
    this.editForm = this.blankEditForm();
    this.editError = null;
  }

  async saveEdit() {
    if (!this.editing || this.saving) return;
    this.editError = null;
    const payload: UpdateStaffDTO = {
      shortName: this.editForm.shortName.trim(),
      email: this.editForm.email.trim(),
      phoneNumber: this.editForm.phoneNumber.trim(),
      startTime: this.normalizeTime(this.editForm.startTime),
      endTime: this.normalizeTime(this.editForm.endTime),
      status: this.editForm.status?.trim() || 'Available',
      active: Boolean(this.editForm.active),
      qualifications: this.parseQualifications(this.editForm.qualifications)
    };
    if (!payload.shortName) {
      this.editError = this.i18n.t('staff.errors.invalidForm');
      return;
    }
    this.saving = true;
    try {
      await this.svc.update(this.editing.mecanographicNumber, payload);
      const idx = this.staff.findIndex(s => s.mecanographicNumber === this.editing!.mecanographicNumber);
      if (idx >= 0) {
        this.staff[idx] = {
          ...this.staff[idx],
          shortName: payload.shortName,
          email: payload.email,
          phoneNumber: payload.phoneNumber,
          startTime: payload.startTime ?? null,
          endTime: payload.endTime ?? null,
          status: payload.status,
          active: payload.active,
          qualifications: payload.qualifications
        };
      }
      this.applyFilters();
      this.toast.success(this.i18n.t('staff.toasts.updated'));
      this.closeEdit();
    } catch (e: any) {
      this.editError = e?.message || this.i18n.t('staff.errors.update');
    } finally {
      this.saving = false;
      try {
        this.cdr.detectChanges();
      } catch {}
    }
  }

  async deactivate(entry: StaffDTO) {
    if (this.rowBusy.has(entry.mecanographicNumber)) return;
    if (!confirm(this.i18n.t('staff.actions.confirmDeactivate'))) return;
    this.rowBusy.add(entry.mecanographicNumber);
    try {
      await this.svc.deactivate(entry.mecanographicNumber);
      entry.active = false;
      entry.status = 'Unavailable';
      this.applyFilters();
      this.toast.info(this.i18n.t('staff.toasts.deactivated'));
    } catch (e: any) {
      this.error = e?.message || this.i18n.t('staff.errors.deactivate');
    } finally {
      this.rowBusy.delete(entry.mecanographicNumber);
      try {
        this.cdr.detectChanges();
      } catch {}
    }
  }

  async reactivate(entry: StaffDTO) {
    if (this.rowBusy.has(entry.mecanographicNumber)) return;
    this.rowBusy.add(entry.mecanographicNumber);
    const payload: UpdateStaffDTO = {
      shortName: entry.shortName,
      email: entry.email,
      phoneNumber: entry.phoneNumber,
      startTime: entry.startTime ?? null,
      endTime: entry.endTime ?? null,
      status: entry.status || 'Available',
      active: true,
      qualifications: entry.qualifications ?? []
    };
    try {
      await this.svc.update(entry.mecanographicNumber, payload);
      entry.active = true;
      if (!entry.status || entry.status.toLowerCase() === 'unavailable') entry.status = 'Available';
      this.applyFilters();
      this.toast.success(this.i18n.t('staff.toasts.reactivated'));
    } catch (e: any) {
      this.error = e?.message || this.i18n.t('staff.errors.reactivate');
    } finally {
      this.rowBusy.delete(entry.mecanographicNumber);
      try {
        this.cdr.detectChanges();
      } catch {}
    }
  }

  formatWindow(entry: StaffDTO) {
    const start = this.timeForInput(entry.startTime);
    const end = this.timeForInput(entry.endTime);
    if (!start && !end) return this.i18n.t('staff.labels.noWindow');
    return `${start || '--'} - ${end || '--'}`;
  }

  hasQualifications(entry: StaffDTO) {
    return Array.isArray(entry.qualifications) && entry.qualifications.length > 0;
  }
}

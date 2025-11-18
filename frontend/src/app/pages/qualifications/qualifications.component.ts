import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QualificationsService, QualificationPayload } from '../../services/qualifications/qualifications.service';

interface Qualification {
  code: string;
  description: string;
}

@Component({
  selector: 'app-qualifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './qualifications.component.html',
  styleUrls: ['./qualifications.component.scss']
})
export class QualificationsComponent implements OnInit {
  qualifications: Qualification[] = [];
  searchTerm = '';
  loading = false;
  error: string | null = null;
  showForm = false;
  isEditing = false;
  current: Qualification = { code: '', description: '' };
  originalCode: string | null = null;
  formError: string | null = null;
  successMessage: string | null = null;

  constructor(
    private service: QualificationsService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.loadQualifications();
  }

  async loadQualifications() {
    this.loading = true;
    this.error = null;
    try {
      const q = (this.searchTerm ?? '').trim();
      this.qualifications = await this.service.getAll(q || undefined);
    } catch (err: any) {
      console.error('Error fetching qualifications', err);
      this.error = err?.message ?? 'Error fetching qualifications.';
    } finally {
      this.loading = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  filtered(): Qualification[] {
    const q = (this.searchTerm ?? '').trim().toLowerCase();
    if (!q) return this.qualifications;
    return this.qualifications.filter(item =>
      item.code.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q));
  }

  newQualification() {
    this.current = { code: '', description: '' };
    this.originalCode = null;
    this.isEditing = false;
    this.formError = null;
    this.showForm = true;
  }

  editQualification(q: Qualification) {
    this.current = { ...q };
    this.originalCode = q.code;
    this.isEditing = true;
    this.formError = null;
    this.showForm = true;
  }

  cancel() {
    this.current = { code: '', description: '' };
    this.showForm = false;
    this.formError = null;
  }

  async save() {
    this.formError = null;
    const code = (this.current.code ?? '').trim();
    const description = (this.current.description ?? '').trim();

    if (!code) {
      this.formError = 'Code is required.';
      return;
    }
    if (!description) {
      this.formError = 'Description is required.';
      return;
    }

    const payload: QualificationPayload = { code, description };

    try {
      if (this.isEditing && this.originalCode) {
        await this.service.update(this.originalCode, payload);
        this.successMessage = 'Qualification updated successfully!';
      } else {
        const created = await this.service.create(payload);
        this.qualifications.unshift(created);
        this.successMessage = 'Qualification created successfully!';
      }

      await this.loadQualifications();
      this.showForm = false;
      try { this.cdr.detectChanges(); } catch {}

      setTimeout(() => {
        this.successMessage = null;
        try { this.cdr.detectChanges(); } catch {}
      }, 3000);
    } catch (err: any) {
      console.error('Save qualification failed', err);
      this.formError = err?.message ?? 'Save failed - check the data.';
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  async delete(code: string) {
    const confirmMsg = `Delete qualification ${code}?`;
    // Provide a minimal guard; assume browser confirm
    if (!confirm(confirmMsg)) return;
    try {
      await this.service.delete(code);
      this.qualifications = this.qualifications.filter(q => q.code !== code);
      try { this.cdr.detectChanges(); } catch {}
    } catch (err: any) {
      console.error('Delete qualification failed', err);
      this.error = err?.message ?? 'Delete failed.';
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  onSearchChange(value: string) {
    this.searchTerm = value;
    if ((value ?? '').trim() === '') {
      setTimeout(() => this.loadQualifications().catch(() => {}), 10);
    }
  }

  clearSearch() {
    this.searchTerm = '';
    this.loadQualifications().catch(() => {});
  }
}

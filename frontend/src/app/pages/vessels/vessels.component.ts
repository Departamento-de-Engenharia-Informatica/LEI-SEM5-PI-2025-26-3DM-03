import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VesselsService } from '../../services/vessels/vessels.service';

interface Vessel {
  imo?: string | null;
  name?: string | null;
  vesselTypeId?: number | null;
  operator?: string | null;
  [key: string]: any;
}

@Component({
  selector: 'app-vessels',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vessels.component.html',
  styleUrls: ['./vessels.component.scss']
})
export class VesselsComponent implements OnInit {
  vessels: any[] = [];
  vesselTypes: any[] = [];
  searchTerm = '';
  loading = false;
  error: string | null = null;
  showForm = false;
  currentVessel: Vessel = {};
  isEditing = false;
  showImoHelp = false;
  originalImo: string | null = null;
  formError: string | null = null;
  successMessage: string | null = null;

  constructor(
    private vesselsService: VesselsService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    try {
      await this.loadVessels();
      const res = await fetch('https://localhost:7167/api/VesselTypes', {
        credentials: 'include'
      });
      if (res.ok) this.vesselTypes = await res.json();
      setTimeout(() => this.loadVessels().catch(() => {}), 120);
    } catch (e) {
      console.error('Error during initialization:', e);
    }
  }

  async loadVessels() {
    this.loading = true; this.error = null;
    try {
      // Trim the search term and only pass a query to the service when it's meaningful
      const q = (this.searchTerm ?? '').trim();
      this.vessels = q ? await this.vesselsService.getAll(q) : await this.vesselsService.getAll();
    } catch (error) {
      console.error('Error fetching vessels:', error);
      this.error = 'Error fetching vessels.';
    } finally {
      this.loading = false;
      // Force Angular change detection to leave the empty-state
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  filteredVessels(): any[] {
    const qRaw = (this.searchTerm ?? '').trim();
    if (!qRaw) return this.vessels;
    const q = qRaw.toLowerCase();
    return this.vessels.filter(v => {
      const name = (v?.name ?? '').toString().toLowerCase();
      const imo = (v?.imo ?? '').toString().toLowerCase();
      return name.includes(q) || imo.includes(q);
    });
  }

  newVessel() {
    this.currentVessel = { name: '', imo: '', vesselTypeId: null, operator: '' };
    this.formError = null;
    this.isEditing = false;
    this.originalImo = null;
    this.showForm = true;
  }

  editVessel(v: any) {
    this.currentVessel = { ...(v || {}) };
    this.originalImo = v.imo;
    this.isEditing = true;
    this.formError = null;
    this.showForm = true;
  }

  cancel() {
    this.currentVessel = {};
    this.showForm = false;
    this.formError = null;
    this.showImoHelp = false;
  }

  // Same check-digit rule used by the API: 7 digits and valid checksum with weights 7..2
  private isValidImo(imo: string): boolean {
    if (!imo) return false;
    const digits = imo.split('').map(d => Number(d));
    if (digits.length !== 7 || digits.some(isNaN)) return false;

    const weights = [7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + digits[i] * w, 0);
    const checkDigit = sum % 10;
    return checkDigit === digits[6];
  }

  async save() {
    this.formError = null;

    const name = (this.currentVessel.name ?? '').trim();
    const imo = (this.currentVessel.imo ?? '').trim();
    const operator = (this.currentVessel.operator ?? '').trim();
    const vesselTypeId = Number(this.currentVessel.vesselTypeId);

    // validations
    if (!name) {
      this.formError = 'Vessel name is required.';
      return;
    }
    if (!/^\d{7}$/.test(imo) || !this.isValidImo(imo)) {
      this.formError = 'Invalid IMO: must be 7 digits with a valid check digit.';
      return;
    }
    if (!vesselTypeId) {
      this.formError = 'Please select a vessel type.';
      return;
    }

    const payload = { imo, name, operator, vesselTypeId };

    try {
      if (this.isEditing && this.originalImo) {
        await this.vesselsService.update(this.originalImo, payload);
        this.successMessage = 'Vessel updated successfully!';
      } else {
        const created = await this.vesselsService.create(payload);
        this.vessels.unshift(created);
        this.successMessage = 'Vessel created successfully!';
      }

      // refresh list and force UI update
      await this.loadVessels();
      this.showForm = false;
      this.cdr.detectChanges(); // ⚡ forces Angular to update immediately

      // Temporary success message
      setTimeout(() => {
        this.successMessage = null;
        this.cdr.detectChanges();
      }, 3000);

    } catch (err: any) {
      console.error('Save vessel failed', err);
      this.formError = err?.message ?? 'Save failed - check the data.';
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  // Called when the search input changes. If cleared, reload the full list.
  onSearchChange(value: string) {
    this.searchTerm = value;
    if ((value ?? '').trim() === '') {
      // small timeout to allow ngModel to settle
      setTimeout(() => this.loadVessels().catch(() => {}), 10);
    }
  }

  // Clear and refresh list immediately
  clearSearch() {
    this.searchTerm = '';
    this.loadVessels().catch(() => {});
  }

  toggleImoHelp() {
    this.showImoHelp = !this.showImoHelp;
  }
}

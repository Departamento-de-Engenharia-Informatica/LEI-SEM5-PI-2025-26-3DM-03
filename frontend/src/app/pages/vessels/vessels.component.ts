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
  showForm = false;
  currentVessel: Vessel = {};
  isEditing = false;
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
    } catch (e) {
      console.error('Erro ao inicializar:', e);
    }
  }

  async loadVessels() {
    try {
      this.vessels = await this.vesselsService.getAll(this.searchTerm);
    } catch (error) {
      console.error('Erro ao buscar vessels:', error);
      this.formError = 'Erro ao buscar vessels.';
    }
  }

  filteredVessels(): any[] {
    if (!this.searchTerm) return this.vessels;
    const q = this.searchTerm.toLowerCase();
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
  }

  async save() {
    this.formError = null;

    const name = (this.currentVessel.name ?? '').trim();
    const imo = (this.currentVessel.imo ?? '').trim();
    const operator = (this.currentVessel.operator ?? '').trim();
    const vesselTypeId = Number(this.currentVessel.vesselTypeId);

    // validações
    if (!name) {
      this.formError = 'Vessel name is required.';
      return;
    }
    if (!/^\d{7}$/.test(imo)) {
      this.formError = 'Invalid IMO: must contain exactly 7 numeric digits.';
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
        this.successMessage = '✅ Vessel updated successfully!';
      } else {
        const created = await this.vesselsService.create(payload);
        this.vessels.unshift(created);
        this.successMessage = '✅ Vessel created successfully!';
      }

      // Atualiza lista e força refresh da UI
      await this.loadVessels();
      this.showForm = false;
      this.cdr.detectChanges(); // ⚡ força o Angular a atualizar imediatamente

      // Mensagem de sucesso temporária
      setTimeout(() => {
        this.successMessage = null;
        this.cdr.detectChanges();
      }, 3000);

    } catch (err: any) {
      console.error('Save vessel failed', err);
      this.formError = err?.message ?? 'Save failed — check the data.';
    }
  }
}

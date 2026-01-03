import { CommonModule } from '@angular/common';
import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../components/toast/toast.service';
import { IncidentTypesService } from '../../services/incident-types/incident-types.service';
import {
  CreateIncidentDTO,
  IncidentDTO,
  IncidentScope,
  IncidentSeverity,
  IncidentStatus,
  UpdateIncidentDTO,
} from '../../models/incident';
import { IncidentTypeDTO } from '../../models/incident-type';
import { OemApiService, VesselVisitExecutionListItem } from '../../oem/oem-api.service';
import { firstValueFrom } from 'rxjs';

type ViewMode = 'list' | 'edit';

@Component({
  selector: 'app-incidents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './incidents.component.html',
  styleUrls: ['./incidents.component.scss'],
})
export class IncidentsComponent implements OnInit {
  loading = false;
  error: string | null = null;

  items: IncidentDTO[] = [];
  filtered: IncidentDTO[] = [];
  incidentTypes: IncidentTypeDTO[] = [];
  vves: VesselVisitExecutionListItem[] = [];

  viewMode: ViewMode = 'list';

  filterVessel = '';
  filterFrom = '';
  filterTo = '';
  filterSeverity: IncidentSeverity | '' = '';
  filterStatus: IncidentStatus | '' = '';
  filterTypeId: number | null = null;
  filterScope: IncidentScope | '' = '';

  newIncident: CreateIncidentDTO = {
    incidentTypeId: 0,
    severity: 'MINOR',
    startTime: '',
    endTime: null,
    description: '',
    scope: 'ALL_ONGOING',
    impactFrom: null,
    impactTo: null,
    affectedVveIds: [],
  };

  editing: IncidentDTO | null = null;
  editingPayload: UpdateIncidentDTO | null = null;
  editingAffectedVves: number[] = [];
  saving = false;
  vveUpdating = false;
  createResolved = false;

  readonly severityOptions: { value: IncidentSeverity; label: string }[] = [
    { value: 'MINOR', label: 'Minor' },
    { value: 'MAJOR', label: 'Major' },
    { value: 'CRITICAL', label: 'Critical' },
  ];

  readonly scopeOptions: { value: IncidentScope; label: string }[] = [
    { value: 'ALL_ONGOING', label: 'All ongoing' },
    { value: 'SPECIFIC', label: 'Specific VVEs' },
    { value: 'UPCOMING', label: 'Upcoming window' },
  ];

  readonly statusOptions: { value: IncidentStatus; label: string }[] = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'RESOLVED', label: 'Resolved' },
  ];

  constructor(
    private readonly incidentTypesService: IncidentTypesService,
    private readonly oemApi: OemApiService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    this.newIncident.startTime = this.nowLocalInput();
    await this.loadReferenceData();
    await this.loadIncidents();
  }

  async loadReferenceData() {
    try {
      const [types, vves] = await Promise.all([
        this.incidentTypesService.getAll(),
        firstValueFrom(this.oemApi.getVesselVisitExecutions()),
      ]);
      this.incidentTypes = types;
      this.vves = vves || [];
    } catch (e: any) {
      this.error = e?.message || 'Falha ao carregar dados de referencia.';
    } finally {
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  async loadIncidents() {
    this.loading = true;
    this.error = null;
    try {
      const from = this.filterFrom ? this.toIso(this.filterFrom) : undefined;
      const to = this.filterTo ? this.toIso(this.filterTo) : undefined;
      const typeId = this.filterTypeId || undefined;
      const incidents = await firstValueFrom(this.oemApi.getIncidents({
        vesselIdentifier: this.filterVessel.trim() || undefined,
        from,
        to,
        severity: this.filterSeverity || undefined,
        status: this.filterStatus || undefined,
        incidentTypeId: typeId,
        scope: this.filterScope || undefined,
      }));
      this.items = incidents;
      this.filtered = incidents;
    } catch (e: any) {
      this.error = e?.message || 'Falha ao carregar incidentes.';
    } finally {
      this.loading = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  resetFilters() {
    this.filterVessel = '';
    this.filterFrom = '';
    this.filterTo = '';
    this.filterSeverity = '';
    this.filterStatus = '';
    this.filterTypeId = null;
    this.filterScope = '';
    this.loadIncidents();
  }

  async createIncident() {
    this.error = null;
    if (!this.newIncident.incidentTypeId) {
      this.error = 'Tipo de incidente e obrigatorio.';
      return;
    }
    if (!this.newIncident.startTime) {
      this.error = 'Hora de inicio e obrigatoria.';
      return;
    }
    if (this.newIncident.scope === 'UPCOMING') {
      if (!this.newIncident.impactFrom || !this.newIncident.impactTo) {
        this.error = 'Janela de impacto e obrigatoria para UPCOMING.';
        return;
      }
    }
    if (this.newIncident.scope === 'SPECIFIC' && (!this.newIncident.affectedVveIds || this.newIncident.affectedVveIds.length === 0)) {
      this.error = 'Selecione pelo menos uma VVE.';
      return;
    }

    const payload: CreateIncidentDTO = {
      incidentTypeId: Number(this.newIncident.incidentTypeId),
      severity: this.newIncident.severity,
      startTime: this.toIso(this.newIncident.startTime),
      description: (this.newIncident.description || '').trim() || null,
      scope: this.newIncident.scope,
    };

    if (this.createResolved) {
      if (!this.newIncident.endTime) {
        this.error = 'Defina o end time para resolver.';
        return;
      }
      payload.endTime = this.toIso(this.newIncident.endTime);
    }

    if (payload.scope === 'UPCOMING') {
      payload.impactFrom = this.newIncident.impactFrom
        ? this.toIso(this.newIncident.impactFrom)
        : undefined;
      payload.impactTo = this.newIncident.impactTo
        ? this.toIso(this.newIncident.impactTo)
        : undefined;
    }

    if (payload.scope === 'SPECIFIC' && this.newIncident.affectedVveIds?.length) {
      payload.affectedVveIds = this.newIncident.affectedVveIds.map((id) => Number(id));
    }

    this.saving = true;
    try {
      const created = await firstValueFrom(this.oemApi.createIncident(payload));
      this.items.unshift(created);
      this.filtered = this.items.slice();
      this.toast.success('Incidente criado');
      this.resetNewIncident();
    } catch (e: any) {
      this.error = e?.message || 'Falha ao criar incidente.';
    } finally {
      this.saving = false;
    }
  }

  openEdit(incident: IncidentDTO) {
    this.editing = incident;
    this.editingPayload = {
      incidentTypeId: incident.incidentTypeId,
      severity: incident.severity,
      startTime: this.toLocalInput(incident.startTime),
      endTime: incident.endTime ? this.toLocalInput(incident.endTime) : null,
      description: incident.description || '',
      scope: incident.scope,
      impactFrom: incident.impactFrom ? this.toLocalInput(incident.impactFrom) : null,
      impactTo: incident.impactTo ? this.toLocalInput(incident.impactTo) : null,
    };
    this.editingAffectedVves = Array.isArray(incident.affectedVveIds)
      ? incident.affectedVveIds.slice()
      : [];
    this.viewMode = 'edit';
  }

  closeEdit() {
    this.editing = null;
    this.editingPayload = null;
    this.editingAffectedVves = [];
    this.viewMode = 'list';
  }

  async saveEdit() {
    if (!this.editing || !this.editingPayload) return;
    this.error = null;

    const payload: UpdateIncidentDTO = {
      incidentTypeId: Number(this.editingPayload.incidentTypeId),
      severity: this.editingPayload.severity,
      startTime: this.editingPayload.startTime ? this.toIso(this.editingPayload.startTime) : undefined,
      endTime: this.editingPayload.endTime ? this.toIso(this.editingPayload.endTime) : null,
      description: (this.editingPayload.description || '').trim() || null,
      scope: this.editingPayload.scope,
      impactFrom: this.editingPayload.impactFrom ? this.toIso(this.editingPayload.impactFrom) : null,
      impactTo: this.editingPayload.impactTo ? this.toIso(this.editingPayload.impactTo) : null,
    };

    this.saving = true;
    try {
      const updated = await firstValueFrom(this.oemApi.updateIncident(this.editing.id, payload));
      this.updateLocalIncident(updated);
      this.toast.success('Incidente atualizado');
      this.closeEdit();
    } catch (e: any) {
      this.error = e?.message || 'Falha ao guardar.';
    } finally {
      this.saving = false;
    }
  }

  async updateAffectedVves() {
    if (!this.editing) return;
    if (this.editing.scope !== 'SPECIFIC') {
      this.error = 'Apenas incidentes SPECIFIC podem ter VVEs associadas.';
      return;
    }
    if (!this.editingAffectedVves.length) {
      this.error = 'Selecione pelo menos uma VVE.';
      return;
    }

    this.vveUpdating = true;
    try {
      const updated = await firstValueFrom(
        this.oemApi.setIncidentAffectedVves(this.editing.id, this.editingAffectedVves),
      );
      this.updateLocalIncident(updated);
      this.toast.success('VVEs atualizadas');
    } catch (e: any) {
      this.error = e?.message || 'Falha ao atualizar VVEs.';
    } finally {
      this.vveUpdating = false;
    }
  }

  async resolveIncident(incident: IncidentDTO) {
    if (incident.status === 'RESOLVED') return;
    const payload: UpdateIncidentDTO = {
      endTime: new Date().toISOString(),
    };
    try {
      const updated = await firstValueFrom(this.oemApi.updateIncident(incident.id, payload));
      this.updateLocalIncident(updated);
      this.toast.success('Incidente resolvido');
    } catch (e: any) {
      this.error = e?.message || 'Falha ao resolver incidente.';
    }
  }

  async deleteIncident(incident: IncidentDTO) {
    if (!confirm('Eliminar este incidente?')) return;
    try {
      await firstValueFrom(this.oemApi.deleteIncident(incident.id));
      this.items = this.items.filter((item) => item.id !== incident.id);
      this.filtered = this.items.slice();
      this.toast.success('Incidente eliminado');
    } catch (e: any) {
      this.error = e?.message || 'Falha ao eliminar incidente.';
    }
  }

  toggleVveSelection(id: number, list?: number[]) {
    if (!list) return;
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(id);
  }

  isVveSelected(id: number, list?: number[]) {
    return Array.isArray(list) && list.includes(id);
  }

  formatDate(value?: string | null) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  severityLabel(value: IncidentSeverity) {
    return this.severityOptions.find((s) => s.value === value)?.label || value;
  }

  scopeLabel(value: IncidentScope) {
    return this.scopeOptions.find((s) => s.value === value)?.label || value;
  }

  statusLabel(value: IncidentStatus) {
    return this.statusOptions.find((s) => s.value === value)?.label || value;
  }

  private updateLocalIncident(updated: IncidentDTO) {
    const idx = this.items.findIndex((item) => item.id === updated.id);
    if (idx >= 0) this.items[idx] = updated;
    this.filtered = this.items.slice();
  }

  private resetNewIncident() {
    this.newIncident = {
      incidentTypeId: 0,
      severity: 'MINOR',
      startTime: this.nowLocalInput(),
      endTime: null,
      description: '',
      scope: 'ALL_ONGOING',
      impactFrom: null,
      impactTo: null,
      affectedVveIds: [],
    };
    this.createResolved = false;
  }

  private nowLocalInput() {
    return this.toLocalInput(new Date().toISOString());
  }

  private toIso(value: string) {
    const d = new Date(value);
    return d.toISOString();
  }

  private toLocalInput(value: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => `${n}`.padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
}

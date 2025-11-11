import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VesselVisitNotificationsService } from '../../services/vessel-visits/vessel-visit-notifications.service';
import { CreateVesselVisitNotificationDTO, VesselVisitNotificationDTO, VisitStatus, ContainerItemDTO, CrewMemberDTO } from '../../models/vessel-visit-notification';
import { DocksService } from '../../services/docks/docks.service';
import type { DockDTO } from '../../models/dock';
import { VesselsService } from '../../services/vessels/vessels.service';
import { AuthService } from '../../services/auth/auth.service';
import { ToastService } from '../../components/toast/toast.service';

@Component({
  selector: 'app-vessel-visit-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vessel-visit-notifications.component.html',
  styleUrls: ['./vessel-visit-notifications.component.scss']
})
export class VesselVisitNotificationsComponent implements OnInit {
  loading = false;
  error: string | null = null;

  notifications: VesselVisitNotificationDTO[] = [];
  filtered: VesselVisitNotificationDTO[] = [];

  q = '';
  status: 'all' | VisitStatus = 'all';
  from: string | null = null; // yyyy-mm-dd
  to: string | null = null;   // yyyy-mm-dd

  // Create modal
  showCreate = false;
  newNotification: any = {
    vesselId: '',
    agentId: null as number | null,
    arrivalDate: '' as string,
    departureDate: '' as string,
    cargoText: '' as string, // helper field (comma/line separated codes)
    captainName: '', captainId: '', captainNationality: '',
    officer1Name: '', officer1Id: '', officer1Nationality: ''
  };
  creating = false;

  docks: DockDTO[] = [];
  vessels: any[] = [];
  // Switch to table + side cards (hide old card grid)
  useTable: boolean = true;

  // Details modal
  showDetails = false;
  selected: VesselVisitNotificationDTO | null = null;

  constructor(
    private vvn: VesselVisitNotificationsService,
    private docksService: DocksService,
    private vesselsService: VesselsService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) {}

  async ngOnInit() {
    await Promise.all([this.loadNotifications(), this.loadDocks(), this.loadVessels()]);
  }

  async loadDocks() {
    try {
      this.docks = await this.docksService.getAll();
    } catch (e) {
      // optional: ignore
      this.docks = [];
    }
  }

  async loadVessels() {
    try {
      this.vessels = await this.vesselsService.getAll();
    } catch (e) {
      this.vessels = [];
    }
  }

  async loadNotifications() {
    this.loading = true;
    this.error = null;
    try {
      const items = await this.vvn.getAll();
      this.notifications = Array.isArray(items) ? items : [];
      this.applyFilterSort();
    } catch (e: any) {
      this.error = e?.message || 'Falha ao carregar notificações de visita.';
    } finally {
      this.loading = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  applyFilterSort() {
    const q = (this.q || '').trim().toLowerCase();
    const fromTs = this.from ? Date.parse(this.from) : null;
    const toTs = this.to ? Date.parse(this.to) : null;

    const filtered = (this.notifications || []).filter(n => {
      // search by vessel name or IMO
      const vid = (n.vesselId || '').toString().toLowerCase();
      const matchQ = !q || vid.includes(q);

      // status
      const matchStatus = this.status === 'all' || n.status === this.status;

      // date range filter compares scheduledArrival
      const arrTs = n.arrivalDate ? Date.parse(n.arrivalDate as any) : NaN;
      const matchFrom = !fromTs || (!isNaN(arrTs) && arrTs >= fromTs);
      const matchTo = !toTs || (!isNaN(arrTs) && arrTs <= toTs + 24*60*60*1000 - 1);

      return matchQ && matchStatus && matchFrom && matchTo;
    });

    filtered.sort((a, b) => {
      const at = a.arrivalDate ? Date.parse(a.arrivalDate as any) : 0;
      const bt = b.arrivalDate ? Date.parse(b.arrivalDate as any) : 0;
      return bt - at; // newest first
    });

    this.filtered = filtered;
  }

  resetFilters() {
    this.q = '';
    this.status = 'all';
    this.from = null;
    this.to = null;
    this.applyFilterSort();
  }

  openCreate() {
    this.newNotification = { vesselId: '', agentId: null, arrivalDate: '', departureDate: '', cargoText: '' };
    // no modal; keep form visible in side card
  }

  closeCreate() {
    this.showCreate = false;
  }

  async create() {
    if (!/^\d{7}$/.test((this.newNotification.vesselId || '').trim())) {
      alert('IMO inválido. Deve conter exatamente 7 dígitos numéricos.');
      return;
    }
    if (!this.newNotification.arrivalDate) {
      alert('Data/hora de chegada é obrigatória.');
      return;
    }
    if (!this.newNotification.agentId) {
      alert('Agent (TaxNumber) é obrigatório.');
      return;
    }
    this.creating = true;
    try {
      // Convert to backend DTO
      const codeRe = /^[A-Z]{4}\d{7}$/;
      const manifest: ContainerItemDTO[] | undefined = (() => {
        const raw = (this.newNotification.cargoText || '').trim();
        if (!raw) return undefined;
        const codes = raw
          .split(/[\s,;\n\r]+/)
          .map((s: string) => s.trim().toUpperCase())
          .filter((s: string) => !!s && codeRe.test(s));
        if (!codes.length) return undefined;
        return codes.map((c: string) => ({ containerCode: c, isForUnloading: false }));
      })();

      const payload: CreateVesselVisitNotificationDTO = {
        vesselId: (this.newNotification.vesselId || '').trim(),
        agentId: Number(this.newNotification.agentId),
        arrivalDate: new Date(this.newNotification.arrivalDate).toISOString(),
        departureDate: this.newNotification.departureDate ? new Date(this.newNotification.departureDate).toISOString() : undefined,
        cargoManifest: manifest,
        crewMembers: (() => {
          const out: CrewMemberDTO[] = [];
          if ((this.newNotification.captainName || '').trim()) {
            out.push({ name: this.newNotification.captainName.trim(), citizenId: (this.newNotification.captainId || '').trim(), nationality: (this.newNotification.captainNationality || '').trim() });
          }
          if ((this.newNotification.officer1Name || '').trim()) {
            out.push({ name: this.newNotification.officer1Name.trim(), citizenId: (this.newNotification.officer1Id || '').trim(), nationality: (this.newNotification.officer1Nationality || '').trim() });
          }
          return out.length ? out : undefined;
        })()
      };
      const created = await this.vvn.create(payload);
      // Optimistically update list
      this.notifications = [created, ...this.notifications];
      this.applyFilterSort();
      this.showCreate = false;
      this.toast.success('Notificação criada');
    } catch (e: any) {
      this.toast.error(e?.message || 'Falha ao criar notificação.');
    } finally {
      this.creating = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  statusClass(s: string | undefined | null): string {
    const v = (s || '').toLowerCase();
    if (v === 'approved') return 'status approved';
    if (v === 'rejected') return 'status rejected';
    if (v === 'cancelled' || v === 'canceled') return 'status cancelled';
    if (v === 'inprogress' || v === 'in_progress' || v === 'processing') return 'status pending';
    if (v === 'completed' || v === 'done') return 'status approved';
    return 'status pending';
  }

  fmtDate(d?: string | null): string {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleString();
  }

  async openDetails(n: VesselVisitNotificationDTO) {
    // Try to refetch for up-to-date data; if it fails, use the provided item
    try {
      if (n?.id !== undefined && n?.id !== null) {
        const fresh = await this.vvn.getById(n.id);
        this.selected = fresh || n;
      } else {
        this.selected = n;
      }
    } catch {
      this.selected = n;
    }
    this.showDetails = true;
    try { this.cdr.detectChanges(); } catch {}
  }

  closeDetails() {
    this.showDetails = false;
    this.selected = null;
  }

  // ===== Agent actions (edit + submit) =====
  editMode = false;
  editForm: { arrivalDate: string; departureDate?: string; cargoText?: string; crew?: CrewMemberDTO[] } = { arrivalDate: '' };

  beginEdit(n?: VesselVisitNotificationDTO) {
    if (n) this.selected = n;
    if (!this.selected) return;
    const s = this.selected;
    this.editForm = {
      arrivalDate: s.arrivalDate ? new Date(s.arrivalDate).toISOString().slice(0,16) : '',
      departureDate: s.departureDate ? new Date(s.departureDate).toISOString().slice(0,16) : undefined,
      cargoText: (s.cargoManifest && s.cargoManifest.length) ? s.cargoManifest.join(', ') : '',
      crew: s.crewMembers ? s.crewMembers.map(x => ({ name: x.name, citizenId: x.citizenId, nationality: x.nationality })) : []
    };
    this.editMode = true;
  }

  cancelEdit() { this.editMode = false; }

  async saveEdit() {
    if (!this.selected) return;
    const id = this.selected.id;
    // serialize
    const body: any = {};
    if (this.editForm.arrivalDate) body.arrivalDate = new Date(this.editForm.arrivalDate).toISOString();
    if (this.editForm.departureDate) body.departureDate = new Date(this.editForm.departureDate).toISOString();
    if (this.editForm.cargoText) {
      const codeRe = /^[A-Z]{4}\d{7}$/;
      const codes = (this.editForm.cargoText || '')
        .split(/[\s,;\n\r]+/)
        .map(s => s.trim().toUpperCase())
        .filter(s => !!s && codeRe.test(s));
      if (codes.length) body.cargoManifest = codes.map(c => ({ containerCode: c, isForUnloading: false }));
    }
    if (this.editForm.crew && this.editForm.crew.length) body.crewMembers = this.editForm.crew;

    try {
      await this.vvn.update(id, body);
      const fresh = await this.vvn.getById(id);
      this.selected = fresh;
      // update list
      const idx = this.notifications.findIndex(x => x.id === id);
      if (idx >= 0) this.notifications[idx] = fresh;
      this.applyFilterSort();
      this.editMode = false;
      this.toast.success('Alterações guardadas');
    } catch (e: any) {
      this.toast.error(e?.message || 'Falha ao guardar. Verifica os dados.');
    }
  }

  async submitSelected() {
    if (!this.selected) return;
    try {
      await this.vvn.submit(this.selected.id);
      const fresh = await this.vvn.getById(this.selected.id);
      this.selected = fresh;
      const idx = this.notifications.findIndex(x => x.id === fresh.id);
      if (idx >= 0) this.notifications[idx] = fresh; else this.notifications.unshift(fresh);
      this.applyFilterSort();
      this.toast.success('Notificação submetida');
    } catch (e: any) {
      this.toast.error(e?.message || 'Falha ao submeter.');
    }
  }

  async submit(n: VesselVisitNotificationDTO) {
    this.selected = n;
    await this.submitSelected();
  }

  // ===== Officer actions (approve/reject) =====
  approveDockId: number | null = null;
  approveOfficerId: number = 1;
  rejectReason = '';

  async approveSelected() {
    if (!this.selected) return;
    if (!this.approveDockId) { alert('Escolhe uma doca.'); return; }
    try {
      await this.vvn.approve(this.selected.id, this.approveDockId!, this.approveOfficerId || 1);
      const fresh = await this.vvn.getById(this.selected.id);
      this.selected = fresh;
      const idx = this.notifications.findIndex(x => x.id === fresh.id);
      if (idx >= 0) this.notifications[idx] = fresh;
      this.applyFilterSort();
      this.toast.success('Notificação aprovada');
    } catch (e: any) {
      this.toast.error(e?.message || 'Falha ao aprovar.');
    }
  }

  async rejectSelected() {
    if (!this.selected) return;
    const reason = (this.rejectReason || '').trim();
    if (!reason) { alert('Indica o motivo da rejeição.'); return; }
    try {
      await this.vvn.reject(this.selected.id, this.approveOfficerId || 1, reason);
      const fresh = await this.vvn.getById(this.selected.id);
      this.selected = fresh;
      const idx = this.notifications.findIndex(x => x.id === fresh.id);
      if (idx >= 0) this.notifications[idx] = fresh;
      this.applyFilterSort();
      this.rejectReason = '';
      this.toast.success('Notificação rejeitada');
    } catch (e: any) {
      this.toast.error(e?.message || 'Falha ao rejeitar.');
    }
  }

  cloneToNewFromSelected() {
    if (!this.selected) return;
    const s = this.selected;
    this.newNotification = {
      vesselId: s.vesselId || '',
      agentId: s.agentId || null,
      arrivalDate: s.arrivalDate ? new Date(s.arrivalDate).toISOString().slice(0,16) : '',
      departureDate: s.departureDate ? new Date(s.departureDate).toISOString().slice(0,16) : '',
      cargoText: (s.cargoManifest && s.cargoManifest.length) ? s.cargoManifest.join(', ') : '',
      captainName: (s.crewMembers && s.crewMembers[0]?.name) || '',
      captainId: (s.crewMembers && s.crewMembers[0]?.citizenId) || '',
      captainNationality: (s.crewMembers && s.crewMembers[0]?.nationality) || '',
      officer1Name: (s.crewMembers && s.crewMembers[1]?.name) || '',
      officer1Id: (s.crewMembers && s.crewMembers[1]?.citizenId) || '',
      officer1Nationality: (s.crewMembers && s.crewMembers[1]?.nationality) || ''
    };
    this.showCreate = true;
  }
}

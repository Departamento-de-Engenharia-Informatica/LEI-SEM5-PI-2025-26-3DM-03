import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ApplicationRef } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize, debounceTime } from 'rxjs/operators';
import {
  OemApiService,
  OperationPlanDto,
  OperationPlanPreviewDto,
  MissingOperationPlanDto,
  OperationPlanTaskDto,
  VesselVisitExecutionListItem,
} from '../oem-api.service';
import { DocksService } from '../../services/docks/docks.service';
import { DockDTO } from '../../models/dock';
import { StorageAreasService } from '../../services/storage-areas/storage-areas.service';
import { StorageAreaDTO } from '../../models/storage-area';
import { ResourcesService } from '../../services/resources/resources.service';
import { ResourceDTO } from '../../models/resource';
import { StaffService } from '../../services/staff/staff.service';
import { StaffDTO } from '../../models/staff';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import flatpickr from 'flatpickr';

type SortKey = 'name' | 'plannedStartTime' | 'vesselVisitId' | 'createdAt';
type AssociateCandidate = VesselVisitExecutionListItem & { vvnMatchesPlan: boolean };

@Component({
  selector: 'app-oem-operation-plans',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './operation-plans.component.html',
  styleUrls: ['./operation-plans.component.scss'],
})
export class OemOperationPlansComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('detailsSheet') detailsSheet?: ElementRef<HTMLElement>;
  @ViewChild('editSheet') editSheet?: ElementRef<HTMLElement>;
  @ViewChild('linkSheet') linkSheet?: ElementRef<HTMLElement>;
  @ViewChild('savedDateRangeInput', { static: false })
  savedDateRangeInput?: ElementRef<HTMLInputElement>;
  form: FormGroup;
  savedFilterForm: FormGroup;

  plans: OperationPlanDto[] = [];
  previewPlans: OperationPlanPreviewDto[] = [];

  loading = false;
  error: string | null = null;

  previewLoading = false;
  previewError: string | null = null;

  persistLoading = false;
  persistError: string | null = null;
  successMessage: string | null = null;

  expandedRows = new Set<number>();
  selectedVvns = new Set<number>();
  savedEmptyMessage: string | null = null;
  savedDateRange = '';
  private savedDatePicker: flatpickr.Instance | null = null;

  sortKey: SortKey = 'plannedStartTime';
  sortDir: 'asc' | 'desc' = 'asc';
  pageSize = 6;
  currentPage = 1;

  editForm: FormGroup;
  editingPlan: OperationPlanDto | null = null;
  editLoading = false;
  editSaving = false;
  editError: string | null = null;
  editWarnings: string[] = [];
  editSuccess: string | null = null;
  editSection: 'summary' | 'tasks' | 'history' = 'summary';

  selectedPlan: OperationPlanDto | null = null;
  detailsLoadingId: number | null = null;
  detailsError: string | null = null;

  deleteLoadingId: number | null = null;
  deleteError: string | null = null;

  associatePlan: OperationPlanDto | null = null;
  associatePlanVvn: number | null = null;
  associateExecutions: AssociateCandidate[] = [];
  associateLoading = false;
  associateLinking = false;
  associateError: string | null = null;
  associateSuccess: string | null = null;
  selectedExecutionId: number | null = null;

  missingForm: FormGroup;
  missingPlans: MissingOperationPlanDto[] = [];
  missingLoading = false;
  missingError: string | null = null;
  missingEmptyMessage: string | null = null;
  missingPageSize = 6;
  missingCurrentPage = 1;
  regenerateLoading = false;
  regenerateError: string | null = null;
  regenerateSuccess: string | null = null;
  showMissingDetails = false;

  // Recursos auxiliares para edição (dropdowns)
  docks: DockDTO[] = [];
  storageAreas: StorageAreaDTO[] = [];
  craneResources: ResourceDTO[] = [];
  staff: StaffDTO[] = [];

  readonly algorithms = [
    { id: 'single-crane', label: 'Single crane' },
    { id: 'multi-crane', label: 'Multi crane' },
  ];

  readonly planStatuses = [
    'draft',
    'planned',
    'in-progress',
    'completed',
    'cancelled',
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: OemApiService,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly appRef: ApplicationRef,
    private readonly docksService: DocksService,
    private readonly storageAreasService: StorageAreasService,
    private readonly resourcesService: ResourcesService,
    private readonly staffService: StaffService,
  ) {
    this.form = this.fb.group({
      date: [this.todayIso(), Validators.required],
      algorithm: ['single-crane', Validators.required],
    });

    this.savedFilterForm = this.fb.group({
      from: [''],
      to: [''],
      vesselVisitId: [''],
    });

    this.missingForm = this.fb.group({
      date: [this.todayIso(), Validators.required],
      algorithm: ['single-crane', Validators.required],
      confirmOverwrite: [false],
    });

    this.editForm = this.createEditForm();
  }

  async ngOnInit(): Promise<void> {
    this.updateSavedDisplayRangeFromForm();
    this.fetchPlans();

    this.savedFilterForm.valueChanges
      .pipe(debounceTime(300))
      .subscribe(() => this.fetchPlans());

    await this.loadReferenceData();
    this.onPreview();
  }

  ngAfterViewInit(): void {
    if (!this.savedDateRangeInput) {
      return;
    }

    const dates = this.getSavedDatesFromForm();
    this.savedDatePicker = flatpickr(this.savedDateRangeInput.nativeElement, {
      mode: 'range',
      dateFormat: 'Y-m-d',
      defaultDate: dates as Date[],
      onChange: (selectedDates: Date[]) => {
        this.zone.run(() => {
          if (selectedDates.length === 2) {
            this.applySavedRange(selectedDates[0], selectedDates[1]);
          }
        });
      },
    });
  }

  ngOnDestroy(): void {
    this.savedDatePicker?.destroy();
    this.savedDatePicker = null;
  }

  get dateControl() {
    return this.form.get('date');
  }

  get hasPreview(): boolean {
    return this.previewPlans.length > 0;
  }

  get missingDateControl() {
    return this.missingForm.get('date');
  }

  get hasMissingPlans(): boolean {
    return this.missingPlans.length > 0;
  }

  get totalMissingPages(): number {
    return Math.max(1, Math.ceil(this.missingPlans.length / this.missingPageSize));
  }

  get pagedMissingPlans(): MissingOperationPlanDto[] {
    const start = (this.missingCurrentPage - 1) * this.missingPageSize;
    return this.missingPlans.slice(start, start + this.missingPageSize);
  }

  get sortedPlans(): OperationPlanDto[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...this.plans].sort((a, b) => {
      const av = this.sortValue(a);
      const bv = this.sortValue(b);
      if (av === bv) {
        return 0;
      }
      return av > bv ? dir : -dir;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sortedPlans.length / this.pageSize));
  }

  get pagedPlans(): OperationPlanDto[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedPlans.slice(start, start + this.pageSize);
  }

  onPreview(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const date = this.form.value.date;
    const algorithm = this.form.value.algorithm || 'single-crane';
    this.previewLoading = true;
    this.previewError = null;
    this.persistError = null;
    this.successMessage = null;

    this.api
      .previewOperationPlans(date, algorithm, this.selectedAsArray())
      .subscribe({
        next: plans => {
          this.zone.run(() => {
            this.previewPlans = plans ?? [];
            this.expandedRows.clear();
            this.selectedVvns = new Set(this.previewPlans.map(p => p.vvnId));
            if (!this.previewPlans.length) {
              this.previewError =
                'Nenhum plano de operacao disponivel para a data selecionada.';
            }
            this.previewLoading = false;
            this.cdr.detectChanges();
          });
        },
        error: (err: HttpErrorResponse) => {
          this.zone.run(() => {
            if (Array.isArray(err.error)) {
              this.previewPlans = err.error as OperationPlanPreviewDto[];
              this.previewError = this.previewPlans.length
                ? null
                : 'Nenhum plano de operacao disponivel para a data selecionada.';
              this.previewLoading = false;
              this.cdr.detectChanges();
              return;
            }

            this.previewPlans = [];
            this.selectedVvns.clear();
            this.previewError = this.normalizeError(
              err,
              'Falha ao gerar o preview dos planos de operacao.',
            );
            this.previewLoading = false;
            this.cdr.detectChanges();
          });
        },
      });
  }

  onPersist(): void {
    if (this.form.invalid || !this.previewPlans.length) {
      this.form.markAllAsTouched();
      return;
    }

    const date = this.form.value.date;
    const algorithm = this.form.value.algorithm || 'single-crane';
    const vvnIds = this.selectedAsArray();

    this.persistLoading = true;
    this.persistError = null;
    this.successMessage = null;

    this.api
      .generateOperationPlans(
        date,
        algorithm,
        vvnIds.length ? vvnIds : undefined,
      )
      .pipe(finalize(() => (this.persistLoading = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'Planos guardados com sucesso.';
          this.previewPlans = [];
          this.selectedVvns.clear();
          this.expandedRows.clear();
          this.fetchPlans();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 409) {
            this.persistError = 'Ja existem planos para esta data.';
            return;
          }

          if (err.status === 0) {
            this.persistError =
              'Falha ao guardar os planos de operacao (erro de rede).';
            this.fetchPlans();
            return;
          }

          this.persistError = this.normalizeError(
            err,
            'Falha ao guardar os planos de operacao.',
          );
        },
      });
  }

  fetchPlans(): void {
    const { from, to, vesselVisitId } = this.savedFilterForm.value;
    this.loading = true;
    this.error = null;
    this.savedEmptyMessage = null;

    this.api
      .getOperationPlans({
        from: from || undefined,
        to: to || undefined,
        vesselVisitId: vesselVisitId || undefined,
      })
      .subscribe({
        next: plans => {
          this.zone.run(() => {
            const data = Array.isArray(plans) ? plans : [];
            this.plans = data;
            this.savedEmptyMessage = this.plans.length
              ? null
              : 'Nenhum plano encontrado para os filtros aplicados.';
            this.currentPage = 1;
            this.loading = false;
            this.cdr.detectChanges();
            this.appRef.tick();
          });
        },
        error: (err: HttpErrorResponse) => {
          this.zone.run(() => {
            this.error = this.normalizeError(
              err,
              'Falha ao carregar os planos guardados.',
            );
            this.savedEmptyMessage = null;
            this.loading = false;
            this.cdr.detectChanges();
            this.appRef.tick();
          });
        },
      });
  }

  onSearchSaved(): void {
    this.currentPage = 1;
    this.fetchPlans();
  }

  resetSavedFilters(): void {
    this.savedFilterForm.reset({
      from: '',
      to: '',
      vesselVisitId: '',
    });
    this.updateSavedDisplayRangeFromForm();
    if (this.savedDatePicker) {
      this.savedDatePicker.clear();
    }
    this.fetchPlans();
  }

  fetchMissingPlans(): void {
    if (this.missingForm.invalid) {
      this.missingForm.markAllAsTouched();
      return;
    }

    const date = this.missingForm.value.date;
    this.missingLoading = true;
    this.missingError = null;
    this.missingEmptyMessage = null;
    this.regenerateError = null;
    this.regenerateSuccess = null;

    this.api
      .getMissingOperationPlans(date)
      .pipe(finalize(() => (this.missingLoading = false)))
      .subscribe({
        next: plans => {
          this.missingPlans = plans ?? [];
          this.missingCurrentPage = 1;
          this.missingEmptyMessage = this.missingPlans.length
            ? null
            : 'Nao existem VVNs sem plano para o dia selecionado.';
        },
        error: (err: HttpErrorResponse) => {
          this.missingError = this.normalizeError(
            err,
            'Falha ao carregar VVNs sem plano.',
          );
          this.missingEmptyMessage = null;
        },
      });
  }

  onSearchMissing(): void {
    this.showMissingDetails = true;
    this.fetchMissingPlans();
  }

  openMissingDetails(): void {
    this.showMissingDetails = true;
    this.fetchMissingPlans();
  }

  closeMissingDetails(): void {
    this.showMissingDetails = false;
  }

  goToMissingPage(page: number): void {
    const target = Math.min(Math.max(1, page), this.totalMissingPages);
    this.missingCurrentPage = target;
  }

  onRegenerateMissing(): void {
    if (this.missingForm.invalid || !this.missingPlans.length) {
      this.missingForm.markAllAsTouched();
      return;
    }

    const { date, algorithm, confirmOverwrite } = this.missingForm.value;

    if (!confirmOverwrite) {
      this.regenerateError =
        'Confirme o overwrite antes de regenerar os planos do dia.';
      this.missingForm.get('confirmOverwrite')?.markAsTouched();
      return;
    }

    this.regenerateLoading = true;
    this.regenerateError = null;
    this.regenerateSuccess = null;

    this.api
      .regenerateMissingOperationPlans(date, algorithm, confirmOverwrite)
      .pipe(finalize(() => (this.regenerateLoading = false)))
      .subscribe({
        next: () => {
          this.regenerateSuccess =
            'Regeneracao concluida. Os planos foram atualizados.';
          this.fetchPlans();
          this.fetchMissingPlans();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 409) {
            this.regenerateError =
              'Existem planos para esta data. Confirme o overwrite para continuar.';
            return;
          }

          this.regenerateError = this.normalizeError(
            err,
            'Falha ao regenerar os planos do dia.',
          );
        },
      });
  }

  generatePlanForMissing(vvn: MissingOperationPlanDto): void {
    const eta = vvn.eta;
    if (!eta) {
      this.previewError = 'Nao foi possivel determinar a data para este VVN.';
      return;
    }

    const dayIso = eta.slice(0, 10);
    const algorithm = this.missingForm.value.algorithm || 'single-crane';

    // Sincroniza o formulario principal com o dia/algoritmo escolhidos na modal
    this.form.patchValue({ date: dayIso, algorithm });

    // Gera preview apenas para este VVN
    this.selectedVvns = new Set([vvn.id]);

    // Fecha a modal para o utilizador ver o preview e poder guardar
    this.showMissingDetails = false;

    this.onPreview();
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }

  startEdit(plan: OperationPlanDto): void {
    this.editingPlan = plan;
    this.editForm = this.createEditForm(plan);
    this.editLoading = true;
    this.editError = null;
    this.editWarnings = [];
    this.editSuccess = null;
    this.editSection = 'summary';
    this.resetModalScroll(this.editSheet, 'edit-sheet');

    this.api
      .getOperationPlan(plan.id)
      .pipe(finalize(() => (this.editLoading = false)))
      .subscribe({
        next: response => {
          this.editingPlan = response;
          this.editForm = this.createEditForm(response);
          if (this.selectedPlan?.id === response.id) {
            this.selectedPlan = response;
          }
        },
        error: (err: HttpErrorResponse) => {
          this.editError = this.normalizeError(
            err,
            'Falha ao carregar detalhes do plano.',
          );
        },
      });
  }

  cancelEdit(): void {
    this.editingPlan = null;
    this.editForm = this.createEditForm();
    this.editWarnings = [];
    this.editSuccess = null;
    this.editError = null;
    this.editSection = 'summary';
  }

  onDeletePlan(plan: OperationPlanDto): void {
    if (!plan) {
      return;
    }

    const confirmed = window.confirm(
      `Tem a certeza que pretende apagar o plano "${plan.name}"? Esta acao nao pode ser desfeita.`,
    );

    if (!confirmed) {
      return;
    }

    this.deleteLoadingId = plan.id;
    this.deleteError = null;

    this.api
      .deleteOperationPlan(plan.id)
      .pipe(finalize(() => (this.deleteLoadingId = null)))
      .subscribe({
        next: () => {
          this.plans = this.plans.filter(p => p.id !== plan.id);
          if (this.editingPlan?.id === plan.id) {
            this.cancelEdit();
          }
          if (this.selectedPlan?.id === plan.id) {
            this.selectedPlan = null;
            this.detailsError = null;
          }
        },
        error: (err: HttpErrorResponse) => {
          this.deleteError = this.normalizeError(
            err,
            'Falha ao apagar o plano de operacao.',
          );
        },
      });
  }

  openAssociate(plan: OperationPlanDto): void {
    this.associatePlan = plan;
    this.associateExecutions = [];
    this.associateLoading = false;
    this.associateLinking = false;
    this.associateError = null;
    this.associateSuccess = null;
    this.selectedExecutionId = null;
    this.associatePlanVvn = this.resolvePlanVvn(plan);
    this.resetModalScroll(this.linkSheet, 'link-sheet');

    if (this.associatePlanVvn === null) {
      this.associateError =
        'Plano sem VVN associado. Nao existem execucoes para associar.';
      return;
    }

    this.associateLoading = true;

    // ✅ FIX: filtrar por VVN (vesselVisitNotificationId) e não por vesselVisitId (VVE ID)
    this.api
      .getVesselVisitExecutions({
        vesselVisitNotificationId: this.associatePlanVvn,
        status: 'in-progress',
      } as any)
      .pipe(finalize(() => (this.associateLoading = false)))
      .subscribe({
        next: executions => {
          const allowedStatuses = new Set([
            'scheduled',
            'pending',
            'in-progress',
            'active',
          ]);

          const available: AssociateCandidate[] = (executions ?? [])
            .filter(
              exec =>
                !exec.operationPlanId &&
                (exec.status ? allowedStatuses.has(exec.status) : false),
            )
            .map(exec => ({
              ...exec,
              vvnMatchesPlan:
                this.associatePlanVvn !== null &&
                exec.vesselVisitNotificationId !== null &&
                exec.vesselVisitNotificationId === this.associatePlanVvn,
            }));

          this.associateExecutions = available;

          if (!available.length) {
            this.associateError =
              'Nenhuma execucao elegivel disponivel para associar a este plano.';
            return;
          }

          if (!available.some(exec => exec.vvnMatchesPlan)) {
            this.associateError =
              'Nao existem execucoes com a mesma VVN deste plano.';
          }
        },
        error: (err: HttpErrorResponse) => {
          this.associateError = this.normalizeError(
            err,
            'Falha ao carregar execucoes para associar.',
          );
        },
      });
  }

  closeAssociate(): void {
    this.associatePlan = null;
    this.associateExecutions = [];
    this.associateLoading = false;
    this.associateLinking = false;
    this.associateError = null;
    this.associateSuccess = null;
    this.selectedExecutionId = null;
    this.associatePlanVvn = null;
  }

  selectExecution(executionId: number): void {
    const candidate = this.associateExecutions.find(exec => exec.id === executionId);
    if (!candidate) {
      return;
    }

    if (!candidate.vvnMatchesPlan) {
      this.associateError = 'Esta execucao pertence a uma VVN diferente do plano.';
      this.selectedExecutionId = null;
      return;
    }

    this.selectedExecutionId = executionId;
    this.associateSuccess = null;
    this.associateError = null;
  }

  confirmAssociate(): void {
    if (!this.associatePlan) {
      return;
    }

    if (this.selectedExecutionId === null) {
      this.associateError = 'Selecione uma execucao para associar.';
      return;
    }

    if (this.associateLinking) {
      return;
    }

    this.associateLinking = true;
    this.associateError = null;
    this.associateSuccess = null;

    this.api
      .linkOperationPlanToVve(this.selectedExecutionId, this.associatePlan.id)
      .pipe(finalize(() => (this.associateLinking = false)))
      .subscribe({
        next: updated => {
          this.associateSuccess = `Plano associado à execucao VVE ${updated.id}.`;
          this.associateExecutions = this.associateExecutions.filter(
            exec => exec.id !== updated.id,
          );
          this.selectedExecutionId = null;
          if (!this.associateExecutions.some(exec => exec.vvnMatchesPlan)) {
            this.associateError =
              'Nao existem mais execucoes com a mesma VVN disponiveis para associar.';
          }
        },
        error: (err: HttpErrorResponse) => {
          this.associateError = this.normalizeError(
            err,
            'Falha ao associar o plano à execucao.',
          );
        },
      });
  }

  onSaveEdit(): void {
    if (!this.editingPlan) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.editError = 'Preencha motivo e estado antes de guardar.';
      return;
    }

    const payload = this.buildUpdatePayload();

    this.editSaving = true;
    this.editError = null;
    this.editWarnings = [];
    this.editSuccess = null;

    this.api
      .updateOperationPlan(this.editingPlan.id, payload)
      .pipe(finalize(() => (this.editSaving = false)))
      .subscribe({
        next: response => {
          this.editingPlan = response.plan;
          this.editWarnings = response.warnings ?? [];
          this.editSuccess = 'Plano atualizado e alteracao registada.';
          this.editForm = this.createEditForm(response.plan);
          this.plans = this.plans.map(p =>
            p.id === response.plan.id ? response.plan : p,
          );
          if (this.selectedPlan?.id === response.plan.id) {
            this.selectedPlan = response.plan;
          }
        },
        error: (err: HttpErrorResponse) => {
          this.editError = this.normalizeError(err, 'Falha ao atualizar o plano.');
        },
      });
  }

  changeSort(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.currentPage = 1;
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(1, page), this.totalPages);
    this.currentPage = target;
  }

  toggleExpanded(vvnId: number): void {
    if (this.expandedRows.has(vvnId)) {
      this.expandedRows.delete(vvnId);
    } else {
      this.expandedRows.add(vvnId);
    }
  }

  togglePlanDetails(plan: OperationPlanDto): void {
    if (!plan) {
      return;
    }

    if (this.selectedPlan?.id === plan.id) {
      this.selectedPlan = null;
      this.detailsError = null;
      return;
    }

    this.selectedPlan = plan;
    this.detailsLoadingId = plan.id;
    this.detailsError = null;
    this.resetModalScroll(this.detailsSheet, 'details-sheet');

    this.api
      .getOperationPlan(plan.id)
      .pipe(finalize(() => (this.detailsLoadingId = null)))
      .subscribe({
        next: response => {
          this.selectedPlan = response;
        },
        error: (err: HttpErrorResponse) => {
          this.detailsError = this.normalizeError(
            err,
            'Falha ao carregar detalhes do plano.',
          );
        },
      });
  }

  setEditSection(section: 'summary' | 'tasks' | 'history'): void {
    this.editSection = section;
  }

  closeDetails(): void {
    this.selectedPlan = null;
    this.detailsError = null;
  }

  formatStaffIds(staffIds?: string[] | null): string {
    return staffIds && staffIds.length ? staffIds.join(', ') : '-';
  }

  formatWarnings(warnings?: string[] | null): string {
    return warnings && warnings.length ? warnings.join(', ') : '-';
  }

  private resetModalScroll(
    target?: ElementRef<HTMLElement>,
    fallbackId?: string,
  ): void {
    setTimeout(() => {
      const element = target?.nativeElement ?? (fallbackId
        ? (document.getElementById(fallbackId) as HTMLElement | null)
        : null);
      if (element) {
        element.scrollTop = 0;
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }, 0);
  }

  isExpanded(vvnId: number): boolean {
    return this.expandedRows.has(vvnId);
  }

  toggleSelected(vvnId: number): void {
    if (this.selectedVvns.has(vvnId)) {
      this.selectedVvns.delete(vvnId);
    } else {
      this.selectedVvns.add(vvnId);
    }
  }

  isSelected(vvnId: number): boolean {
    return this.selectedVvns.has(vvnId);
  }

  trackByVvn(_: number, item: OperationPlanPreviewDto): number {
    return item.vvnId;
  }

  private selectedAsArray(): number[] {
    return Array.from(this.selectedVvns);
  }

  private sortValue(plan: OperationPlanDto): string | number {
    switch (this.sortKey) {
      case 'name':
        return plan.name?.toLowerCase() ?? '';
      case 'vesselVisitId':
        return plan.vesselVisitId?.toString().toLowerCase() ?? '';
      case 'createdAt':
        return plan.createdAt ? new Date(plan.createdAt).getTime() : 0;
      case 'plannedStartTime':
      default:
        return plan.plannedStartTime
          ? new Date(plan.plannedStartTime).getTime()
          : 0;
    }
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

  private async loadReferenceData(): Promise<void> {
    try {
      const [docks, areas, resources, staff] = await Promise.all([
        this.docksService.getAll().catch(() => []),
        this.storageAreasService.getAll().catch(() => []),
        this.resourcesService.getAll().catch(() => []),
        this.staffService.getAll().catch(() => []),
      ]);

      this.docks = Array.isArray(docks) ? docks : [];
      this.storageAreas = Array.isArray(areas) ? areas : [];
      const allResources = Array.isArray(resources) ? resources : [];
      this.craneResources = allResources.filter(r =>
        (r.type ?? '').toLowerCase().includes('crane'),
      );
      this.staff = Array.isArray(staff) ? staff : [];
    } catch {
      // Em caso de erro nos recursos auxiliares, mantemos os inputs operacionais
    }
  }

  private todayIso(): string {
    const now = new Date();
    const pad = (v: number) => v.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  private getSavedDatesFromForm(): Date[] {
    const { from, to } = this.savedFilterForm.value;
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

  private applySavedRange(start: Date, end: Date): void {
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    this.savedFilterForm.patchValue(
      {
        from: this.toDateInput(startDay),
        to: this.toDateInput(endDay),
      },
      { emitEvent: false },
    );

    this.updateSavedDisplayRange(startDay, endDay);
  }

  private updateSavedDisplayRangeFromForm(): void {
    const dates = this.getSavedDatesFromForm();
    if (dates.length === 2) {
      this.updateSavedDisplayRange(dates[0], dates[1]);
    } else {
      this.savedDateRange = '';
    }
  }

  private updateSavedDisplayRange(from: Date, to: Date): void {
    const formatter = new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    this.savedDateRange = `${formatter.format(from)} a ${formatter.format(to)}`;
  }

  private toDateInput(date: Date): string {
    const pad = (v: number) => v.toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    return `${yyyy}-${mm}-${dd}`;
  }

  private createEditForm(plan?: OperationPlanDto): FormGroup {
    return this.fb.group({
      dockId: [plan?.dockId ?? ''],
      status: [plan?.status ?? 'planned', Validators.required],
      reason: ['', Validators.required],
      tasks: this.fb.array(
        (plan?.tasks ?? []).map(task => this.buildTaskGroup(task)),
      ),
    });
  }

  get taskControls(): FormArray {
    return this.editForm.get('tasks') as FormArray;
  }

  addTask(): void {
    this.taskControls.push(this.buildTaskGroup());
  }

  removeTask(index: number): void {
    this.taskControls.removeAt(index);
  }

  private buildTaskGroup(task?: OperationPlanTaskDto) {
    return this.fb.group({
      id: [task?.id ?? null],
      type: [task?.type ?? '', Validators.required],
      craneId: [task?.craneId ?? ''],
      storageAreaId: [task?.storageAreaId ?? ''],
      staffIds: [task?.staffIds ?? []],
      startTime: [this.toLocalInput(task?.startTime), Validators.required],
      endTime: [this.toLocalInput(task?.endTime), Validators.required],
    });
  }

  private buildUpdatePayload(): { reason: string } & Partial<OperationPlanDto> {
    const value = this.editForm.value as any;

    const tasksArray = this.taskControls.getRawValue() as any[];
    const tasks = tasksArray.map(raw => {
      const rawStaff = raw.staffIds as string[] | undefined;
      const staffIds = Array.isArray(rawStaff) && rawStaff.length
        ? rawStaff
        : undefined;
      return {
        id: raw.id ?? undefined,
        type: (raw.type as string)?.trim(),
        craneId: raw.craneId || undefined,
        storageAreaId: raw.storageAreaId || undefined,
        staffIds,
        startTime: this.fromLocalInput(raw.startTime),
        endTime: this.fromLocalInput(raw.endTime),
      };
    });

    return {
      reason: (value.reason as string)?.trim(),
      dockId: value.dockId || undefined,
      status: value.status,
      tasks,
    };
  }

  private toLocalInput(value?: string | null): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private fromLocalInput(value?: string | null): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString();
  }

  private resolvePlanVvn(plan: OperationPlanDto | null): number | null {
    if (!plan) {
      return null;
    }

    const raw = (plan.vesselVisitId ?? plan.sourceVvnId) as
      | string
      | number
      | null
      | undefined;

    if (raw === undefined || raw === null) {
      return null;
    }

    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }
}
 

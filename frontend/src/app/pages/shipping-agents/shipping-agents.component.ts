import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/i18n/translate.mock.module';
import { ShippingAgentsService } from '../../services/shipping-agents/shipping-agents.service';
import { ToastService } from '../../components/toast/toast.service';
import { TranslationService } from '../../services/i18n/translation.service';
import { CreateShippingAgentDTO, ShippingAgentDTO } from '../../models/shipping-agent';
import { RepresentativeDTO } from '../../models/representative';

@Component({
  selector: 'app-shipping-agents',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './shipping-agents.component.html',
  styleUrls: ['./shipping-agents.component.scss']
})
export class ShippingAgentsComponent {
  // NIF para pesquisa
  taxNumber: number | null = null;

  // estado de UI
  loading = false;
  error: string | null = null;

  // agente carregado
  organization: ShippingAgentDTO | null = null;

  // tipos permitidos
  allowedTypes: string[] = ['Owner', 'Operator'];

  // dados do novo agente
  newOrg: CreateShippingAgentDTO = this.buildEmptyOrg();

  // representante principal criado em conjunto com o agente
  primaryRep: RepresentativeDTO = this.buildEmptyRep();

  constructor(
    private svc: ShippingAgentsService,
    private toast: ToastService,
    private i18n: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  // ============ LOAD EXISTING ORG ============

  async load() {
    if (!this.taxNumber) {
      this.error = this.i18n.t('orgs.errors.taxRequired');
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      const org = await this.svc.getByTaxNumber(this.taxNumber);
      if (!org) {
        this.organization = null;
        this.error = this.i18n.t('orgs.errors.notFound');
      } else {
        this.organization = org;
      }
    } catch (e: any) {
      this.error = e?.message || this.i18n.t('orgs.errors.load');
      this.organization = null;
    } finally {
      this.loading = false;
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  // ============ CREATE ORG + PRIMARY REP ============

  async create() {
  if (!this.newOrg.taxNumber) {
    this.error = this.i18n.t('orgs.errors.taxRequired');
    return;
  }

  // validação simples do representante obrigatório
  if (!this.primaryRep.name || !this.primaryRep.email) {
    this.error = this.i18n.t('reps.errors.create'); // já existe no i18n
    return;
  }

  this.error = null;

  // DTO que vamos enviar para o backend:
  const dto: CreateShippingAgentDTO = {
    ...this.newOrg,
    representatives: [
      {
        ...this.primaryRep,
        // valores que o backend normalmente ignora/substitui,
        // mas são obrigatórios no DTO
        id: 0,
        isActive: true
      }
    ]
  };

  try {
    const created = await this.svc.create(dto);
    this.organization = created;
    this.toast.success(this.i18n.t('orgs.toasts.created'));

    // reset do formulário
    this.newOrg = this.buildEmptyOrg();
    this.primaryRep = this.buildEmptyRep();
  } catch (e: any) {
    if (e?.message === 'DUPLICATE_TAX') {
      // NIF já existe
      this.error = this.i18n.t('orgs.errors.taxExists');
    } else {
      // erro genérico de criação
      this.error = this.i18n.t('orgs.errors.create');
    }
  } finally {
    try { this.cdr.detectChanges(); } catch {}
  }
}
  // ============ HELPERS ============

  formatAddress(org: ShippingAgentDTO | null) {
    if (!org?.address) return '—';
    const { street, postalCode, city, country } = org.address;
    return `${street}, ${postalCode} ${city}, ${country}`;
  }

  private buildEmptyOrg(): CreateShippingAgentDTO {
    return {
      taxNumber: 0,
      legalName: '',
      alternativeName: '',
      type: 'Owner',
      address: {
        street: '',
        city: '',
        postalCode: '',
        country: ''
      },
      representatives: []
    };
  }

  private buildEmptyRep(): RepresentativeDTO {
    return {
      id: 0,
      name: '',
      citizenID: '',
      nationality: '',
      email: '',
      phoneNumber: '',
      isActive: true
    };
  }
}

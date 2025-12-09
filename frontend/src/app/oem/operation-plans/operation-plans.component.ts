import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { OemApiService, OperationPlanDto } from '../oem-api.service';

@Component({
  selector: 'app-oem-operation-plans',
  templateUrl: './operation-plans.component.html',
  styleUrls: ['./operation-plans.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class OemOperationPlansComponent implements OnInit {
  plans: OperationPlanDto[] = [];
  loading = false;
  error: string | null = null;

  constructor(private readonly oemApi: OemApiService) {}

  ngOnInit(): void {
    this.fetchPlans();
  }

  private fetchPlans(): void {
    this.loading = true;
    this.error = null;
    this.oemApi.getOperationPlans().subscribe({
      next: (plans) => {
        this.plans = plans ?? [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load operation plans', err);
        this.error = err?.error?.message || 'Falha ao carregar os planos de operação.';
        this.loading = false;
      },
    });
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export interface OperationPlanDto {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  vesselVisitId?: string | null;
  createdAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OemApiService {
  private readonly baseUrl = '/oem';

  constructor(private readonly http: HttpClient) {}

  getOperationPlans() {
    return this.http.get<OperationPlanDto[]>(`${this.baseUrl}/operation-plans`, { withCredentials: true });
  }
}

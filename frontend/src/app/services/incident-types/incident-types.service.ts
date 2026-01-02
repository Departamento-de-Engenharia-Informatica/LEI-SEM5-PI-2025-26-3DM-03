import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
import {
  CreateIncidentTypeDTO,
  IncidentTypeDTO,
  IncidentTypeFilters,
  IncidentTypeTreeDTO,
  UpdateIncidentTypeDTO,
} from '../../models/incident-type';

const OEM_BASES = (() => {
  const bases = new Set<string>();
  bases.add(`${API_BASE_URL}/api/oem`);

  if (window.location.hostname === 'localhost') {
    bases.add('http://localhost:3000/api/oem');
  }

  return Array.from(bases);
})();

@Injectable({ providedIn: 'root' })
export class IncidentTypesService {
  private readonly resourcePaths = OEM_BASES.map((base) => `${base}/incident-types`);

  constructor(private readonly http: HttpClient) {}

  private buildParams(filters?: IncidentTypeFilters, tree?: boolean): HttpParams | undefined {
    let params = new HttpParams();

    if (filters?.parentId !== undefined && filters?.parentId !== null && Number.isFinite(filters.parentId)) {
      params = params.set('parentId', String(filters.parentId));
    }
    if (filters?.severity) {
      params = params.set('severity', filters.severity);
    }
    if (filters?.q) {
      const trimmed = filters.q.trim();
      if (trimmed) {
        params = params.set('q', trimmed);
      }
    }
    if (tree) {
      params = params.set('tree', 'true');
    }

    return params.keys().length ? params : undefined;
  }

  private async handleRequest<T>(observable: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(observable);
    } catch (err: any) {
      if (err instanceof HttpErrorResponse) {
        const detail = err.error?.message || err.error?.detail || err.statusText || 'Erro de comunicação';
        throw new Error(detail);
      }
      throw err;
    }
  }

  private async executeWithFallback<T>(
    call: (endpoint: string) => Observable<T>,
  ): Promise<T> {
    let lastError: unknown = null;
    for (const endpoint of this.resourcePaths) {
      try {
        return await this.handleRequest(call(endpoint));
      } catch (err: any) {
        lastError = err;
        if (!(err instanceof Error)) {
          continue;
        }
        const message = err.message?.toLowerCase?.() ?? '';
        if (message.includes('not found') || message.includes('failed to fetch') || message.includes('erro de comunicação')) {
          continue;
        }
        if (err instanceof HttpErrorResponse && (err.status === 404 || err.status === 0 || err.status === 502)) {
          continue;
        }
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Falha ao contactar OEM API');
  }

  async getAll(filters?: IncidentTypeFilters): Promise<IncidentTypeDTO[]> {
    const params = this.buildParams(filters);
    return this.executeWithFallback<IncidentTypeDTO[]>((endpoint) =>
      this.http.get<IncidentTypeDTO[]>(endpoint, {
        params,
        withCredentials: true,
      }),
    );
  }

  async getTree(filters?: IncidentTypeFilters): Promise<IncidentTypeTreeDTO[]> {
    const params = this.buildParams(filters, true);
    return this.executeWithFallback<IncidentTypeTreeDTO[]>((endpoint) =>
      this.http.get<IncidentTypeTreeDTO[]>(endpoint, {
        params,
        withCredentials: true,
      }),
    );
  }

  async create(dto: CreateIncidentTypeDTO): Promise<IncidentTypeDTO> {
    return this.executeWithFallback<IncidentTypeDTO>((endpoint) =>
      this.http.post<IncidentTypeDTO>(endpoint, dto, {
        withCredentials: true,
      }),
    );
  }

  async update(id: number, dto: UpdateIncidentTypeDTO): Promise<IncidentTypeDTO> {
    return this.executeWithFallback<IncidentTypeDTO>((endpoint) =>
      this.http.patch<IncidentTypeDTO>(`${endpoint}/${id}`, dto, {
        withCredentials: true,
      }),
    );
  }

  async delete(id: number): Promise<void> {
    await this.executeWithFallback<void>((endpoint) =>
      this.http.delete<void>(`${endpoint}/${id}`, {
        withCredentials: true,
      }),
    );
  }
}

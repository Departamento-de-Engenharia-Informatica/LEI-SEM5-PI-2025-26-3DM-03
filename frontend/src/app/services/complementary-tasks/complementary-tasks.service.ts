import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
import {
  ComplementaryTaskDTO,
  ComplementaryTaskFilters,
  CreateComplementaryTaskDTO,
  UpdateComplementaryTaskDTO,
} from '../../models/complementary-task';

const OEM_BASES = (() => {
  const bases = new Set<string>();
  bases.add(`${API_BASE_URL}/api/oem`);

  if (window.location.hostname === 'localhost') {
    bases.add('http://localhost:3000/api/oem');
  }

  return Array.from(bases);
})();

@Injectable({ providedIn: 'root' })
export class ComplementaryTasksService {
  private readonly resourcePaths = OEM_BASES.map((base) => `${base}/complementary-tasks`);

  constructor(private readonly http: HttpClient) {}

  private buildParams(filters?: ComplementaryTaskFilters): HttpParams | undefined {
    if (!filters) return undefined;
    let params = new HttpParams();
    if (filters.vveId !== undefined && filters.vveId !== null) {
      params = params.set('vveId', String(filters.vveId));
    }
    if (filters.vesselIdentifier) {
      params = params.set('vesselIdentifier', filters.vesselIdentifier.trim());
    }
    if (filters.status) params = params.set('status', filters.status);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return params.keys().length ? params : undefined;
  }

  private async handleRequest<T>(observable: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(observable);
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse) {
        const detail =
          err.error?.message || err.error?.detail || err.statusText || 'Erro de comunicação';
        throw new Error(detail);
      }
      throw err;
    }
  }

  private async executeWithFallback<T>(factory: (endpoint: string) => Observable<T>): Promise<T> {
    let lastError: unknown = null;

    for (const endpoint of this.resourcePaths) {
      try {
        return await this.handleRequest(factory(endpoint));
      } catch (err: unknown) {
        lastError = err;

        if (!(err instanceof Error)) {
          continue;
        }

        const message = err.message?.toLowerCase?.() ?? '';
        if (
          message.includes('not found') ||
          message.includes('failed to fetch') ||
          message.includes('erro de comunicação')
        ) {
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

  async list(filters?: ComplementaryTaskFilters): Promise<ComplementaryTaskDTO[]> {
    const params = this.buildParams(filters);
    return this.executeWithFallback((endpoint) =>
      this.http.get<ComplementaryTaskDTO[]>(endpoint, {
        params,
        withCredentials: true,
      }),
    );
  }

  async create(payload: CreateComplementaryTaskDTO): Promise<ComplementaryTaskDTO> {
    return this.executeWithFallback((endpoint) =>
      this.http.post<ComplementaryTaskDTO>(endpoint, payload, { withCredentials: true }),
    );
  }

  async update(id: number, payload: UpdateComplementaryTaskDTO): Promise<ComplementaryTaskDTO> {
    return this.executeWithFallback((endpoint) =>
      this.http.patch<ComplementaryTaskDTO>(`${endpoint}/${id}`, payload, {
        withCredentials: true,
      }),
    );
  }

  async delete(id: number): Promise<void> {
    await this.executeWithFallback((endpoint) =>
      this.http.delete<void>(`${endpoint}/${id}`, { withCredentials: true }),
    );
  }
}

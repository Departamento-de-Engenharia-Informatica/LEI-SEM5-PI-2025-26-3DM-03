import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
import {
  ComplementaryTaskCategoryDTO,
  ComplementaryTaskCategoryFilters,
  CreateComplementaryTaskCategoryDTO,
  UpdateComplementaryTaskCategoryDTO,
} from '../../models/complementary-task-category';

const OEM_BASES = (() => {
  const bases = new Set<string>();
  bases.add(`${API_BASE_URL}/api/oem`);

  if (window.location.hostname === 'localhost') {
    bases.add('http://localhost:3000/api/oem');
  }

  return Array.from(bases);
})();

@Injectable({ providedIn: 'root' })
export class ComplementaryTaskCategoriesService {
  private readonly resourcePaths = OEM_BASES.map((base) => `${base}/complementary-task-categories`);

  constructor(private readonly http: HttpClient) {}

  private buildParams(filters?: ComplementaryTaskCategoryFilters): HttpParams | undefined {
    if (!filters?.q || !filters.q.trim()) {
      return undefined;
    }

    return new HttpParams().set('q', filters.q.trim());
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

  async list(filters?: ComplementaryTaskCategoryFilters): Promise<ComplementaryTaskCategoryDTO[]> {
    const params = this.buildParams(filters);

    return this.executeWithFallback((endpoint) =>
      this.http.get<ComplementaryTaskCategoryDTO[]>(endpoint, {
        params,
        withCredentials: true,
      }),
    );
  }

  async create(payload: CreateComplementaryTaskCategoryDTO): Promise<ComplementaryTaskCategoryDTO> {
    return this.executeWithFallback((endpoint) =>
      this.http.post<ComplementaryTaskCategoryDTO>(endpoint, payload, {
        withCredentials: true,
      }),
    );
  }

  async update(
    id: number,
    payload: UpdateComplementaryTaskCategoryDTO,
  ): Promise<ComplementaryTaskCategoryDTO> {
    return this.executeWithFallback((endpoint) =>
      this.http.patch<ComplementaryTaskCategoryDTO>(`${endpoint}/${id}`, payload, {
        withCredentials: true,
      }),
    );
  }

  async delete(id: number): Promise<void> {
    await this.executeWithFallback((endpoint) =>
      this.http.delete<void>(`${endpoint}/${id}`, {
        withCredentials: true,
      }),
    );
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SharedResource } from '../../models/public-resource';

@Injectable({ providedIn: 'root' })
export class PublicResourcesService {
  private readonly apiPath = '/api/public-resources';
  private readonly directHost = 'https://localhost:7167';

  constructor(private http: HttpClient) {}

  private buildUrl(path: string, direct: boolean): string {
    return `${direct ? this.directHost : ''}${this.apiPath}${path}`;
  }

  private async executeWithFallback<T>(suffix: string, invoker: (url: string) => Promise<T>): Promise<T> {
    try {
      return await invoker(this.buildUrl(suffix, false));
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 0) {
        return invoker(this.buildUrl(suffix, true));
      }
      throw err;
    }
  }

  async list(): Promise<SharedResource[]> {
    return this.executeWithFallback('', (url) =>
      firstValueFrom(this.http.get<SharedResource[]>(url, { withCredentials: true }))
    );
  }

  async download(id: number): Promise<Blob> {
    return this.executeWithFallback(`/${id}/download`, (url) =>
      firstValueFrom(
        this.http.get(url, {
          withCredentials: true,
          responseType: 'blob' as const
        })
      )
    );
  }

  async upload(file: File, description?: string | null): Promise<SharedResource> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    return this.executeWithFallback('', (url) =>
      firstValueFrom(this.http.post<SharedResource>(url, formData, { withCredentials: true }))
    );
  }

  async remove(id: number): Promise<void> {
    await this.executeWithFallback(`/${id}`, (url) =>
      firstValueFrom(this.http.delete<void>(url, { withCredentials: true }))
    );
  }
}

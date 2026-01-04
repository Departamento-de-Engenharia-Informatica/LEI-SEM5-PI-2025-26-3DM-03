import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DataRightsRequest, DataRightsRequestPayload, PublicDataRightsRequest, PublicDataRightsRequestPayload } from '../../models/data-rights';

@Injectable({ providedIn: 'root' })
export class DataRightsService {
  private readonly apiPath = '/api/data-rights';
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

  async exportPersonalData(format: 'json' | 'pdf' = 'json', fields: string[] = []): Promise<Blob> {
    const params = new URLSearchParams({ format });
    if (fields.length) params.set('fields', fields.join(','));
    const suffix = `/export?${params.toString()}`;
    return this.executeWithFallback(suffix, (url) =>
      firstValueFrom(
        this.http.get(url, {
          withCredentials: true,
          responseType: 'blob' as const
        })
      )
    );
  }

  async createRequest(payload: DataRightsRequestPayload): Promise<any> {
    return this.executeWithFallback('/requests', (url) =>
      firstValueFrom(this.http.post(url, payload, { withCredentials: true }))
    );
  }

  async createPublicRequest(payload: PublicDataRightsRequestPayload): Promise<any> {
    return this.executeWithFallback('/public-requests', (url) =>
      firstValueFrom(this.http.post(url, payload))
    );
  }

  async listMyRequests(): Promise<DataRightsRequest[]> {
    return this.executeWithFallback('/requests', (url) =>
      firstValueFrom(this.http.get<DataRightsRequest[]>(url, { withCredentials: true }))
    );
  }

  async listAllRequests(): Promise<DataRightsRequest[]> {
    return this.executeWithFallback('/requests/all', (url) =>
      firstValueFrom(this.http.get<DataRightsRequest[]>(url, { withCredentials: true }))
    );
  }

  async updateStatus(id: number, status: string, responseNote?: string): Promise<DataRightsRequest> {
    return this.executeWithFallback(`/requests/${id}/status`, (url) =>
      firstValueFrom(this.http.patch<DataRightsRequest>(url, { status, responseNote }, { withCredentials: true }))
    );
  }

  async listPublicRequests(): Promise<PublicDataRightsRequest[]> {
    return this.executeWithFallback('/public-requests', (url) =>
      firstValueFrom(this.http.get<PublicDataRightsRequest[]>(url, { withCredentials: true }))
    );
  }
}

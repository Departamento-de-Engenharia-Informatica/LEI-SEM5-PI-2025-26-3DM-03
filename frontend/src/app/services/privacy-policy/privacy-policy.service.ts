import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PrivacyPolicy, PrivacyPolicyNotice } from '../../models/privacy-policy';

@Injectable({ providedIn: 'root' })
export class PrivacyPolicyService {
  private readonly apiPath = '/api/privacy-policy';
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

  async getCurrent(): Promise<PrivacyPolicy> {
    return this.executeWithFallback('/current', (url) =>
      firstValueFrom(this.http.get<PrivacyPolicy>(url, { withCredentials: true }))
    );
  }

  async getHistory(): Promise<PrivacyPolicy[]> {
    return this.executeWithFallback('/history', (url) =>
      firstValueFrom(this.http.get<PrivacyPolicy[]>(url, { withCredentials: true }))
    );
  }

  async publish(payload: { title?: string | null; content: string }): Promise<PrivacyPolicy> {
    return this.executeWithFallback('', (url) =>
      firstValueFrom(this.http.post<PrivacyPolicy>(url, payload, { withCredentials: true }))
    );
  }

  async checkNotice(): Promise<PrivacyPolicyNotice> {
    return this.executeWithFallback('/notice', (url) =>
      firstValueFrom(this.http.get<PrivacyPolicyNotice>(url, { withCredentials: true }))
    );
  }

  async acknowledge(): Promise<void> {
    await this.executeWithFallback('/ack', (url) =>
      firstValueFrom(this.http.post<void>(url, {}, { withCredentials: true }))
    );
  }
}

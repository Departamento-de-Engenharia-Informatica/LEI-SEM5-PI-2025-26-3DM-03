import { Injectable } from '@angular/core';
import { CreateShippingAgentDTO, ShippingAgentDTO } from '../../models/shipping-agent';

const apiBase = '/api';

@Injectable({ providedIn: 'root' })
export class ShippingAgentsService {
  private buildBase() {
    return `${apiBase}/ShippingAgents`;
  }

  private async requestWithFallback(urlPath: string, options?: RequestInit): Promise<Response> {
    const proxyUrl = `${urlPath}`.startsWith('/api') ? urlPath : `${apiBase}${urlPath}`;
    const directUrl = `https://localhost:7167${proxyUrl}`;

    const fetchWithTimeout = async (url: string, opts: RequestInit | undefined, timeoutMs = 2000) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const merged = { ...(opts || {}), signal: controller.signal } as RequestInit;
        return await fetch(url, merged);
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      const rDirect = await fetchWithTimeout(directUrl, options, 2500);
      if (rDirect.ok || rDirect.status === 404) return rDirect;
      console.warn(`ShippingAgentsService: direct returned ${rDirect.status} for ${directUrl}, trying proxy`);
    } catch (e: any) {
      console.warn('ShippingAgentsService: direct fetch failed or timed out, trying proxy', e?.message ?? e);
    }

    try {
      return await fetchWithTimeout(proxyUrl, options, 2500);
    } catch (e: any) {
      console.error('ShippingAgentsService: proxy fetch failed', e?.message ?? e);
      throw new Error('Both direct and proxy requests failed');
    }
  }

  async getByTaxNumber(taxNumber: number | string): Promise<ShippingAgentDTO | null> {
    const res = await this.requestWithFallback(`${this.buildBase()}/${encodeURIComponent(String(taxNumber))}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return (await res.json()) as ShippingAgentDTO;
  }

  async create(dto: CreateShippingAgentDTO): Promise<ShippingAgentDTO> {
    const res = await this.requestWithFallback(this.buildBase(), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    });

    if (!res.ok) {
      // 409 = tax number já existe (assumindo que o backend devolve este código)
      if (res.status === 409) {
        throw new Error('DUPLICATE_TAX');
      }

      // restante: erro genérico de criação
      throw new Error('CREATE_FAILED');
    }

    return (await res.json()) as ShippingAgentDTO;
  }
}

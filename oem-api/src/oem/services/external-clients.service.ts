import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import * as https from 'https';
import { ExternalServicesConfig } from '../config/http.config';

export type VesselVisitNotification = {
  id: string;
  vesselName?: string;
  vesselVisitId?: string;
  eta?: string;
  etd?: string;
  berth?: string;
  service?: string;
};

@Injectable()
export class ExternalClientsService {
  constructor(private readonly http: HttpService) {}

  // Example hooks to be used in next user stories; currently placeholders.
  callVesselVisitNotifications(path: string, config?: AxiosRequestConfig) {
    return this.http.get(
      `${ExternalServicesConfig.vesselVisitNotificationsUrl}${path}`,
      this.enrichConfig(ExternalServicesConfig.vesselVisitNotificationsUrl, config),
    );
  }

  fetchVvnsForDay(targetDay: string) {
    return this.callVesselVisitNotifications(`/vvn?date=${targetDay}`);
  }

  callResources(path: string, config?: AxiosRequestConfig) {
    return this.http.get(
      `${ExternalServicesConfig.resourcesUrl}${path}`,
      this.enrichConfig(ExternalServicesConfig.resourcesUrl, config),
    );
  }

  callStaff(path: string, config?: AxiosRequestConfig) {
    return this.http.get(
      `${ExternalServicesConfig.staffUrl}${path}`,
      this.enrichConfig(ExternalServicesConfig.staffUrl, config),
    );
  }

  callStorageAreas(path: string, config?: AxiosRequestConfig) {
    return this.http.get(
      `${ExternalServicesConfig.storageAreasUrl}${path}`,
      this.enrichConfig(ExternalServicesConfig.storageAreasUrl, config),
    );
  }

  private enrichConfig(baseUrl: string, config?: AxiosRequestConfig): AxiosRequestConfig {
    const finalConfig: AxiosRequestConfig = { ...(config ?? {}) };

    if (baseUrl.startsWith('https://')) {
      finalConfig.httpsAgent =
        finalConfig.httpsAgent ?? new https.Agent({ rejectUnauthorized: false });
    }

    return finalConfig;
  }
}

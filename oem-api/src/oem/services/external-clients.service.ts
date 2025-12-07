import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { ExternalServicesConfig } from '../config/http.config';

@Injectable()
export class ExternalClientsService {
  constructor(private readonly http: HttpService) {}

  // Example hooks to be used in next user stories; currently placeholders.
  callVesselVisitNotifications(
    path: string,
    config?: AxiosRequestConfig,
  ) {
    return this.http.get(
      `${ExternalServicesConfig.vesselVisitNotificationsUrl}${path}`,
      config,
    );
  }

  callResources(path: string, config?: AxiosRequestConfig) {
    return this.http.get(
      `${ExternalServicesConfig.resourcesUrl}${path}`,
      config,
    );
  }

  callStaff(path: string, config?: AxiosRequestConfig) {
    return this.http.get(
      `${ExternalServicesConfig.staffUrl}${path}`,
      config,
    );
  }

  callStorageAreas(path: string, config?: AxiosRequestConfig) {
    return this.http.get(
      `${ExternalServicesConfig.storageAreasUrl}${path}`,
      config,
    );
  }
}

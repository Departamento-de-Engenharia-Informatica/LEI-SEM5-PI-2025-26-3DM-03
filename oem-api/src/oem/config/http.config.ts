const todoApiBaseUrl =
  process.env.TODO_API_BASE_URL ||
  process.env.VESSEL_VISIT_NOTIFICATIONS_URL ||
  'https://localhost:7167/api';

export const ExternalServicesConfig = {
  vesselVisitNotificationsUrl: process.env.VESSEL_VISIT_NOTIFICATIONS_URL || todoApiBaseUrl,
  resourcesUrl: process.env.RESOURCES_URL || todoApiBaseUrl,
  staffUrl: process.env.STAFF_URL || todoApiBaseUrl,
  storageAreasUrl: process.env.STORAGE_URL || todoApiBaseUrl,
};

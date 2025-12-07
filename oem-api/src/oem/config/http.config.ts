export const ExternalServicesConfig = {
  vesselVisitNotificationsUrl:
    process.env.VESSEL_VISIT_NOTIFICATIONS_URL ?? 'http://vvn.local/api',
  resourcesUrl: process.env.RESOURCES_URL ?? 'http://resources.local/api',
  staffUrl: process.env.STAFF_URL ?? 'http://staff.local/api',
  storageAreasUrl: process.env.STORAGE_URL ?? 'http://storage.local/api',
};

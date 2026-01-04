import { Routes } from '@angular/router';
import { Cube } from './components/visualization/cube/cube.component';
import { PortSceneComponent } from './components/visualization/port-scene/port-scene.component';
import { WarehouseComponent } from './components/visualization/warehouse/warehouse.component';
import { DockCraneComponent } from './components/visualization/crane/dockcrane.component';
import { FinalSceneComponent } from './components/visualization/final-scene/final-scene.component';
import { TruckComponent } from './components/visualization/truck/truck.component';
import { CargoVesselComponent } from './components/visualization/vessel/cargo-vessel.component';
import { GroundComponent } from './components/visualization/ground/ground.component';
import { AuthGuard } from './services/auth/auth.guard';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { OemOperationPlansComponent } from './oem/operation-plans/operation-plans.component';
import { VesselVisitExecutionsHistoryComponent } from './oem/vessel-visit-executions-history/vessel-visit-executions-history.component';

export const routes: Routes = [
  // Default dashboard for all authenticated profiles
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },

  // Lazy load standalone components per-route to avoid bundling all pages upfront.
  { path: 'vessels', loadComponent: () => import('./pages/vessels/vessels.component').then(m => m.VesselsComponent), canActivate: [AuthGuard], data: { roles: ['admin','authority'] } },
  { path: 'docks', loadComponent: () => import('./pages/docks/docks.component').then(m => m.DocksComponent), canActivate: [AuthGuard], data: { roles: ['admin','authority'] } },
  { path: 'storage-areas', loadComponent: () => import('./pages/storage-areas/storage-areas.component').then(m => m.StorageAreasComponent), canActivate: [AuthGuard], data: { roles: ['admin','authority'] } },
  { path: 'resources', loadComponent: () => import('./pages/resources/resources.component').then(m => m.ResourcesComponent), canActivate: [AuthGuard], data: { roles: ['admin','operator'] } },
  { path: 'qualifications', loadComponent: () => import('./pages/qualifications/qualifications.component').then(m => m.QualificationsComponent), canActivate: [AuthGuard], data: { roles: ['admin','operator'] } },
  { path: 'staff', loadComponent: () => import('./pages/staff/staff.component').then(m => m.StaffComponent), canActivate: [AuthGuard], data: { roles: ['admin','operator'] } },
  { path: 'scheduling', loadComponent: () => import('./pages/scheduling/scheduling.component').then(m => m.SchedulingComponent), canActivate: [AuthGuard], data: { roles: ['admin','operator'] } },
  { path: 'scheduling-dev', loadComponent: () => import('./pages/scheduling-dev/scheduling-dev.component').then(m => m.SchedulingDevComponent), canActivate: [AuthGuard], data: { roles: ['admin','operator'] } },
  { path: 'representatives', loadComponent: () => import('./pages/representatives/representatives.component').then(m => m.RepresentativesComponent), canActivate: [AuthGuard], data: { roles: ['admin','authority'] } },
  { path: 'shipping-agents', loadComponent: () => import('./pages/shipping-agents/shipping-agents.component').then(m => m.ShippingAgentsComponent), canActivate: [AuthGuard], data: { roles: ['admin','authority'] } },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent), canActivate: [AuthGuard], data: { roles: ['admin'] } },
  { path: 'public-resources', loadComponent: () => import('./pages/public-resources/public-resources.component').then(m => m.PublicResourcesComponent), canActivate: [AuthGuard], data: { roles: ['admin','operator','agent','authority'] } },
  { path: 'privacy-policy', loadComponent: () => import('./pages/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent) },
  { path: 'data-rights', loadComponent: () => import('./pages/data-rights-public/data-rights-public.component').then(m => m.DataRightsPublicComponent) },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent), canActivate: [AuthGuard] },
  { path: 'incident-types', loadComponent: () => import('./pages/incident-types/incident-types.component').then(m => m.IncidentTypesComponent), canActivate: [AuthGuard], data: { roles: ['admin','logistics-operator'] } },
  { path: 'incidents', loadComponent: () => import('./pages/incidents/incidents.component').then(m => m.IncidentsComponent), canActivate: [AuthGuard], data: { roles: ['admin','logistics-operator'] } },
  { path: 'oem/complementary-task-categories', loadComponent: () => import('./pages/complementary-task-categories/complementary-task-categories.component').then(m => m.ComplementaryTaskCategoriesComponent), canActivate: [AuthGuard], data: { roles: ['admin','logistics-operator'] } },
  { path: 'oem/complementary-tasks', loadComponent: () => import('./pages/complementary-tasks/complementary-tasks.component').then(m => m.ComplementaryTasksComponent), canActivate: [AuthGuard], data: { roles: ['admin','logistics-operator'] } },
  { path: 'oem/operation-plans', component: OemOperationPlansComponent, canActivate: [AuthGuard], data: { roles: ['admin','logistics-operator'] } },
  { path: 'oem/vessel-visit-executions', component: VesselVisitExecutionsHistoryComponent, canActivate: [AuthGuard], data: { roles: ['admin','logistics-operator'] } },
  { path: 'oem/vessel-visit-executions/:id', loadComponent: () => import('./oem/vessel-visit-execution-detail/vessel-visit-execution-detail.component').then(m => m.VesselVisitExecutionDetailComponent), canActivate: [AuthGuard], data: { roles: ['admin','logistics-operator'] } },
  { path: 'oem/resource-allocation', loadComponent: () => import('./oem/resource-allocation/resource-allocation.component').then(m => m.ResourceAllocationComponent), canActivate: [AuthGuard], data: { roles: ['admin','logistics-operator'] } },

  // Vessel Visit Notifications
  { path: 'vessel-visit-notifications', loadComponent: () => import('./pages/vessel-visit-notifications/vessel-visit-notifications.component').then(m => m.VesselVisitNotificationsComponent), canActivate: [AuthGuard], data: { roles: ['admin','authority','agent'] } },

  // Vessel Types
  { path: 'vessel-types', loadComponent: () => import('./pages/vessel-types/vessel-types.component').then(m => m.VesselTypesComponent), canActivate: [AuthGuard], data: { roles: ['admin','authority'] } },

  // Login remains public
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },

  // Demo route for Three.js cube (standalone component)
  { path: 'cube', component: Cube },
  // Demo route for standalone warehouse object
  { path: 'warehouse', component: WarehouseComponent, canActivate: [AuthGuard], data: { roles: ['admin','operator','agent','authority'] } },
  { path: 'house-3d', component: WarehouseComponent, canActivate: [AuthGuard], data: { roles: ['admin','operator','agent','authority'] } },
  { path: 'final-3d', component: FinalSceneComponent, canActivate: [AuthGuard], data: { roles: ['admin','operator','agent','authority'] } },
  // Port 3D scene
  { path: 'port', component: PortSceneComponent },
  // Standalone crane viewer
  { path: 'crane', component: DockCraneComponent },
  // Truck GLB viewer
  { path: 'truck', component: TruckComponent, canActivate: [AuthGuard], data: { roles: ['admin','operator','agent','authority'] } },
  // Cargo vessel GLB viewer
  { path: 'cargo-vessel', component: CargoVesselComponent, canActivate: [AuthGuard], data: { roles: ['admin','operator','agent','authority'] } },
  { path: 'ground', component: GroundComponent, canActivate: [AuthGuard], data: { roles: ['admin','operator','agent','authority'] } },

  // Public minimal 3D viewer page (test-only)
  { path: 'viewer', loadComponent: () => import('./pages/viewer/viewer.component').then(m => m.ViewerComponent) },

  // Redirect root & wildcard to dashboard so every role has a landing page
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];

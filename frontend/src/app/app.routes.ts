import { Routes } from '@angular/router';
import { AuthGuard } from './services/auth/auth.guard';

export const routes: Routes = [
  // Lazy load standalone components per-route to avoid bundling all pages upfront.
  { path: 'vessels', loadComponent: () => import('./pages/vessels/vessels.component').then(m => m.VesselsComponent), canActivate: [AuthGuard], data: { roles: ['admin','authority'] } },
  { path: 'docks', loadComponent: () => import('./pages/docks/docks.component').then(m => m.DocksComponent), canActivate: [AuthGuard], data: { roles: ['admin','authority'] } },
  { path: 'storage-areas', loadComponent: () => import('./pages/storage-areas/storage-areas.component').then(m => m.StorageAreasComponent), canActivate: [AuthGuard], data: { roles: ['admin','authority'] } },
  { path: 'resources', loadComponent: () => import('./pages/resources/resources.component').then(m => m.ResourcesComponent), canActivate: [AuthGuard], data: { roles: ['admin','operator'] } },
  { path: 'representatives', loadComponent: () => import('./pages/representatives/representatives.component').then(m => m.RepresentativesComponent), canActivate: [AuthGuard], data: { roles: ['admin','authority'] } },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent), canActivate: [AuthGuard], data: { roles: ['admin'] } },

  // Login remains public
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },

  // Fallback wildcard MUST be last
  { path: '**', redirectTo: 'vessels' },
];

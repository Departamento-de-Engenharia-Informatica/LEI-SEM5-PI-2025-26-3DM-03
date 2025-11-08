import { Routes } from '@angular/router';
import { VesselsComponent } from './pages/vessels/vessels.component';
import { DocksComponent } from './pages/docks/docks.component';
import { StorageAreasComponent } from './pages/storage-areas/storage-areas.component';
import { ResourcesComponent } from './pages/resources/resources.component';
import { AuthGuard } from './services/auth/auth.guard';
import { LoginComponent } from './pages/login/login.component';

export const routes: Routes = [
  { path: '**', redirectTo: 'vessels'},
  { path: 'vessels', component: VesselsComponent  }, // ,  canActivate: [AuthGuard]
  { path: 'docks', component: DocksComponent }, // ,  canActivate: [AuthGuard]
  { path: 'login', component: LoginComponent },
  { path: 'storage-areas', component: StorageAreasComponent   }, // ,  canActivate: [AuthGuard]
  { path: 'resources', component: ResourcesComponent  }, // ,  canActivate: [AuthGuard]
];

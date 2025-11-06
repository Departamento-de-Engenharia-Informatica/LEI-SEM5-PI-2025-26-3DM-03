import { Routes } from '@angular/router';
import { VesselsComponent } from './pages/vessels/vessels.component';
import { DocksComponent } from './pages/docks/docks.component';
import { StorageAreasComponent } from './pages/storage-areas/storage-areas.component';


export const routes: Routes = [
  { path: '', redirectTo: '/vessels', pathMatch: 'full' },
  { path: 'vessels', component: VesselsComponent },
  { path: 'docks', component: DocksComponent },
  { path: 'storage-areas', component: StorageAreasComponent },
];

import { Routes } from '@angular/router';
import { VesselsComponent } from './pages/vessels/vessels.component';
import { DocksComponent } from './pages/docks/docks.component';


export const routes: Routes = [
  { path: '', redirectTo: '/vessels', pathMatch: 'full' },
  { path: 'vessels', component: VesselsComponent },
  { path: 'docks', component: DocksComponent },
];

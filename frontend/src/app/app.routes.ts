import { Routes } from '@angular/router';
import { VesselsComponent } from './pages/vessels/vessels.component';

export const routes: Routes = [
  { path: '', redirectTo: '/vessels', pathMatch: 'full' },
  { path: 'vessels', component: VesselsComponent },
];

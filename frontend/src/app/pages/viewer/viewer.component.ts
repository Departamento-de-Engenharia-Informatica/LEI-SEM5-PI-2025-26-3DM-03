import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Cube } from '../../components/visualization/cube/cube.component';
import { PortSceneComponent } from '../../components/visualization/port-scene/port-scene.component';
import { DockCraneComponent } from '../../components/visualization/crane/dockcrane.component';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule, PortSceneComponent, DockCraneComponent, Cube],
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss']
})
export class ViewerComponent {
  mode: 'port' | 'crane' | 'demo' = 'port';

  setMode(m: 'port' | 'crane' | 'demo') {
    this.mode = m;
  }
}

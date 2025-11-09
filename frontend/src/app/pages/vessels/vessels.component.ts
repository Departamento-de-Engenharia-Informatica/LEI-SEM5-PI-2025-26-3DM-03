import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/i18n/translate.mock.module';
import { VesselsService } from '../../services/vessels/vessels.service';

@Component({
  selector: 'app-vessels',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './vessels.component.html',
  styleUrls: ['./vessels.component.scss']
})
export class VesselsComponent implements OnInit {
  vessels: any[] = [];

  constructor(private vesselsService: VesselsService) {}

  async ngOnInit() {
    try {
      this.vessels = await this.vesselsService.getAll();
      console.log('Vessels carregados:', this.vessels);
    } catch (error) {
      console.error('Erro ao buscar vessels:', error);
    }
  }
}

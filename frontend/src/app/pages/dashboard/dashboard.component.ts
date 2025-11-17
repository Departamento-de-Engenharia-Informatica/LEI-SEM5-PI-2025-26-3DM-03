import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  cards = [
    { title: 'Bem-vindo', description: 'Selecione uma opção no menu lateral para começar.' },
    { title: 'Estado do utilizador', description: 'As permissões foram aplicadas com base no seu perfil interno.' }
  ];
}

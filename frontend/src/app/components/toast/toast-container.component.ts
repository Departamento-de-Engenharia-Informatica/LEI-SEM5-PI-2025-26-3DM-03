import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.scss']
})
export class ToastContainerComponent {
  constructor(private toast: ToastService) {}
  get toasts$() { return this.toast.toasts$; }
  dismiss(t: Toast) { this.toast.dismiss(t.id); }
}

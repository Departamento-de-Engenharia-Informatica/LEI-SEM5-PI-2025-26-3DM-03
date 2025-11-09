import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';
export interface Toast { id: number; type: ToastType; text: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 1;
  private _toasts = new BehaviorSubject<Toast[]>([]);
  toasts$ = this._toasts.asObservable();

  private push(type: ToastType, text: string, duration = 2500) {
    const id = this.seq++;
    const toast: Toast = { id, type, text };
    const arr = this._toasts.value.slice();
    arr.push(toast);
    this._toasts.next(arr);
    if (duration > 0) setTimeout(() => this.dismiss(id), duration);
  }

  success(text: string, duration = 2500) { this.push('success', text, duration); }
  error(text: string, duration = 3500) { this.push('error', text, duration); }
  info(text: string, duration = 2500) { this.push('info', text, duration); }

  dismiss(id: number) {
    this._toasts.next(this._toasts.value.filter(t => t.id !== id));
  }
  clear() { this._toasts.next([]); }
}


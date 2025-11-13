import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PortLayoutDTO {
  units: string;
  water: { width: number; height: number; y: number };
  landAreas: { x: number; z: number; width: number; depth: number; y: number }[];
  docks: {
    name: string;
    position: { x: number; y: number; z: number };
    size: { length: number; width: number; height: number };
    rotationY: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class PortLayoutService {
  constructor(private http: HttpClient) {}

  getLayout(): Observable<PortLayoutDTO> {
    return this.http.get<PortLayoutDTO>('/api/port-layout');
  }
}

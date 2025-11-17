import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface WaterPatch {
  width: number;
  height: number;
  y: number;
}

export interface Vector3Lite {
  x: number;
  y: number;
  z: number;
}

export interface DockSize {
  length: number;
  width: number;
  height: number;
}

export interface DockLayout {
  dockId: number;
  name: string;
  position: Vector3Lite;
  size: DockSize;
  rotationY: number;
}

export interface LandAreaLayout {
  storageAreaId: number;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  y: number;
}

export interface WarehouseLayout {
  storageAreaId: number;
  name: string;
  position: Vector3Lite;
  size: { width: number; depth: number; height: number };
  rotationY: number;
}

export interface PortLayoutDTO {
  units: string;
  water: WaterPatch;
  landAreas: LandAreaLayout[];
  docks: DockLayout[];
  warehouses: WarehouseLayout[];
  materials?: MaterialLibraryDTO;
}

export interface MaterialLibraryDTO {
  dock?: DockMaterialDTO;
}

export interface DockMaterialDTO {
  top?: SurfaceMaterialDTO;
  side?: SurfaceMaterialDTO;
  trim?: SurfaceMaterialDTO;
}

export interface SurfaceMaterialDTO {
  color?: string;
  roughness?: number;
  metalness?: number;
  colorMap?: ProceduralTextureDescriptor;
  roughnessMap?: ProceduralTextureDescriptor;
}

export interface ProceduralTextureDescriptor {
  pattern: 'stripe' | 'noise' | 'grid';
  primaryColor: string;
  secondaryColor?: string;
  scale?: number;
  strength?: number;
  rotation?: number;
}

@Injectable({ providedIn: 'root' })
export class PortLayoutService {
  constructor(private http: HttpClient) {}

  getLayout(): Observable<PortLayoutDTO> {
    return this.http.get<PortLayoutDTO>('/api/port-layout');
  }
}

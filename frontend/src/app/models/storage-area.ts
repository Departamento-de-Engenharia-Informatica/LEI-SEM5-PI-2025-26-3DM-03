export interface StorageAreaDTO {
  id: number;
  type?: string | null;
  location?: string | null;
  maxCapacityTEU: number;
  currentOccupancyTEU: number;
  servedDockIds?: number[];
  dockDistances?: Record<number, number>;
}

export interface CreateStorageAreaDTO {
  type: string;
  location: string;
  maxCapacityTEU: number;
  currentOccupancyTEU: number;
  servedDockIds?: number[];
  dockDistances?: Record<number, number>;
}

export interface UpdateStorageAreaDTO extends CreateStorageAreaDTO {
  id: number;
}

export interface VesselTypeDTO {
  id: number;
  name: string;
}

export interface DockDTO {
  id: number;
  name: string;
  location: string;
  length: number;
  depth: number;
  maxDraft: number;
  allowedVesselTypes?: VesselTypeDTO[];
}

export interface CreateDockDTO {
  name: string;
  location: string;
  length: number;
  depth: number;
  maxDraft: number;
  allowedVesselTypeIds?: number[];
}

export interface UpdateDockDTO extends CreateDockDTO {
  id: number;
}

export interface OperationalConstraintsDTO {
  maxRows: number;
  maxBays: number;
  maxTiers: number;
}

export interface VesselTypeDTO {
  id: number;
  name: string;
  description: string;
  capacity: number;
  operationalConstraints: OperationalConstraintsDTO;
}

export interface CreateVesselTypeDTO {
  name: string;
  description: string;
  capacity: number;
  // backend supports both nested and flattened, we’ll send nested
  operationalConstraints: OperationalConstraintsDTO;
}

export interface UpdateVesselTypeDTO extends CreateVesselTypeDTO {
  id: number;
}


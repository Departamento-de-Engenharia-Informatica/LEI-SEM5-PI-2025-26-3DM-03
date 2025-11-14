export interface StaffDTO {
  mecanographicNumber: string;
  shortName: string;
  email: string;
  phoneNumber: string;
  startTime?: string | null;
  endTime?: string | null;
  status: string;
  active: boolean;
  qualifications: string[];
}

export interface CreateStaffDTO {
  mecanographicNumber: string;
  shortName: string;
  email: string;
  phoneNumber: string;
  startTime?: string | null;
  endTime?: string | null;
  qualifications: string[];
}

export interface UpdateStaffDTO {
  shortName: string;
  email: string;
  phoneNumber: string;
  startTime?: string | null;
  endTime?: string | null;
  status: string;
  active: boolean;
  qualifications: string[];
}

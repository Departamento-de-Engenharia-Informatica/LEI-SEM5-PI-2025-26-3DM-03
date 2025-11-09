export interface RepresentativeDTO {
  id: number;
  name: string;
  citizenID: string;
  nationality: string;
  email: string;
  phoneNumber: string;
  isActive: boolean;
}

export interface CreateRepresentativeDTO {
  name: string;
  citizenID: string;
  nationality: string;
  email: string;
  phoneNumber: string;
}

export interface UpdateRepresentativeDTO {
  name: string;
  citizenID: string;
  nationality: string;
  email: string;
  phoneNumber: string;
  isActive: boolean;
}


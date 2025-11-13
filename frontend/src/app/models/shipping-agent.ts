import { RepresentativeDTO } from './representative';

export interface AddressDTO { street: string; city: string; postalCode: string; country: string; }

export interface ShippingAgentDTO {
  taxNumber: number;
  legalName: string;
  alternativeName: string;
  type: 'Owner' | 'Operator' | string;
  address: AddressDTO;
  representatives: RepresentativeDTO[];
}

export type CreateShippingAgentDTO = Omit<ShippingAgentDTO, 'representatives'> & { representatives?: RepresentativeDTO[] };
export interface DataRightsRequestPayload {
  type: 'access' | 'rectification' | 'deletion';
  fields?: string[];
  details?: string;
}

export interface PublicDataRightsRequestPayload {
  name: string;
  email: string;
  type: 'access' | 'rectification' | 'deletion';
  details?: string;
}

export interface DataRightsRequest {
  id: number;
  requestType: string;
  status: string;
  requestedAtUtc: string;
  requestedByEmail?: string | null;
  respondedAtUtc?: string | null;
  responseNote?: string | null;
  fields: string[];
  details?: string | null;
}

export interface PublicDataRightsRequest {
  id: number;
  requestType: string;
  requestedAtUtc: string;
  requestedByName: string;
  requestedByEmail: string;
  details?: string | null;
}

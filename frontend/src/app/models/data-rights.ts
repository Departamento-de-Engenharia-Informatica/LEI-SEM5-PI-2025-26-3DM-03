export interface DataRightsRequestPayload {
  type: 'access' | 'rectification' | 'deletion';
  fields?: string[];
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

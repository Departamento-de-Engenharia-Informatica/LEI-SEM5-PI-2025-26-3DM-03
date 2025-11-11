export type VisitStatus = 'InProgress' | 'Submitted' | 'PendingApproval' | 'Approved' | 'Rejected' | 'Cancelled' | 'Pending';

export interface CrewMemberDTO {
  name: string;
  citizenId: string;
  nationality: string;
}

export interface ContainerItemDTO {
  containerCode: string;
  cargoType?: string | null;
  isForUnloading: boolean;
}

// Mirrors backend TodoApi.Models.VesselVisitNotifications.VesselVisitNotificationDTO
export interface VesselVisitNotificationDTO {
  id: number;
  vesselId: string; // IMO or external id
  agentId: number;
  arrivalDate: string; // ISO
  departureDate?: string | null; // ISO
  cargoManifest?: string[] | null; // On read, backend returns string codes
  crewMembers?: CrewMemberDTO[] | null;
  status: string; // backend uses strings e.g. InProgress, Approved
  submissionTimestamp?: string | null; // ISO
  approvedDockId?: number | null;
  rejectionReason?: string | null;
  decisionTimestamp?: string | null; // ISO
  officerId?: number | null;
  submittedByRepresentativeEmail?: string | null;
  submittedByRepresentativeName?: string | null;
}

// Mirrors backend CreateVesselVisitNotificationDTO
export interface CreateVesselVisitNotificationDTO {
  vesselId: string;
  agentId: number; // likely ShippingAgent TaxNumber
  arrivalDate: string; // ISO
  departureDate?: string; // ISO
  cargoManifest?: ContainerItemDTO[];
  crewMembers?: CrewMemberDTO[];
  submittedByRepresentativeEmail?: string;
  submittedByRepresentativeName?: string;
}

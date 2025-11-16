export interface SharedResource {
  id: number;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string | null;
  description?: string | null;
}

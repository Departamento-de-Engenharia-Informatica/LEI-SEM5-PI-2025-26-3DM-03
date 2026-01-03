export interface PrivacyPolicy {
  id: number;
  version: number;
  title: string;
  content: string;
  publishedAtUtc: string;
  isCurrent: boolean;
  publishedBy?: string | null;
}

export interface PrivacyPolicyNotice {
  hasUpdate: boolean;
  currentId?: number | null;
  currentVersion?: number | null;
  currentPublishedAtUtc?: string | null;
}

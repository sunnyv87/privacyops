import { ConsentStatus, LawfulBasis } from '../enums';

export interface ConsentRecordResponse {
  id: string;
  dataSubjectId: string;
  dataSubjectEmail: string;
  noticeId: string;
  noticeName: string;
  purposeId: string;
  purposeName: string;
  status: ConsentStatus;
  lawfulBasis: LawfulBasis;
  grantedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  channel: string;
  ipAddress: string | null;
}

export interface ConsentNoticeResponse {
  id: string;
  name: string;
  version: string;
  content: string;
  purposes: { id: string; name: string; description: string }[];
  isActive: boolean;
  createdAt: string;
}

export interface ConsentStats {
  totalRecords: number;
  granted: number;
  revoked: number;
  expired: number;
  byPurpose: { purpose: string; granted: number; revoked: number }[];
}

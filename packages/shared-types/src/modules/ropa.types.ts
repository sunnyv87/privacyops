import { LawfulBasis } from '../enums';

export interface RopaEntryResponse {
  id: string;
  processingPurpose: string;
  description: string;
  lawfulBasis: LawfulBasis;
  dataCategories: string[];
  dataSubjectCategories: string[];
  recipients: string[];
  crossBorderTransfers: string[];
  retentionPeriod: string;
  technicalMeasures: string[];
  organizationalMeasures: string[];
  dpiRequired: boolean;
  ownerId: string;
  ownerName: string;
  lastReviewedAt: string | null;
  createdAt: string;
}

export interface RopaExport {
  tenantName: string;
  exportDate: string;
  entries: RopaEntryResponse[];
  totalEntries: number;
}

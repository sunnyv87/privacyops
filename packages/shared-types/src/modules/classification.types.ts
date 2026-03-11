import { ClassificationMethod, ClassificationCategory, Severity } from '../enums';

export interface ClassificationResult {
  fieldId: string;
  fieldName: string;
  labelId: string;
  labelName: string;
  category: ClassificationCategory;
  confidence: number;
  method: ClassificationMethod;
  sampleMatches?: string[];
}

export interface ClassificationSummary {
  assetId: string;
  assetName: string;
  totalFields: number;
  classifiedFields: number;
  labels: { name: string; category: ClassificationCategory; count: number }[];
  highestSensitivity: number;
  toxicCombinations: ToxicCombination[];
}

export interface ToxicCombination {
  labels: string[];
  riskDescription: string;
  severity: Severity;
}

export interface ClassificationLabelResponse {
  id: string;
  name: string;
  category: ClassificationCategory;
  sensitivityLevel: number;
  description: string;
}

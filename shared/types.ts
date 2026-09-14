export type QualityStatus = "pending" | "passed" | "failed";

export interface QualityCheck {
  id: string;
  title: string;
  area: string;
  status: QualityStatus;
  notes: string;
  createdAt: string;
}

export interface CreateQualityCheckInput {
  title: string;
  area: string;
  status?: QualityStatus;
  notes?: string;
}

export interface QualitySummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  passRate: number;
}

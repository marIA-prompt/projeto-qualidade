import type {
  CreateQualityCheckInput,
  QualityCheck,
  QualitySummary,
} from "../shared/types.ts";

export interface ChecksResponse {
  checks: QualityCheck[];
  summary: QualitySummary;
}

async function parseError(res: Response): Promise<never> {
  let message = `Request failed with status ${res.status}`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {
    // ignore non-JSON error bodies
  }
  throw new Error(message);
}

export async function fetchChecks(): Promise<ChecksResponse> {
  const res = await fetch("/api/checks");
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function createCheck(
  input: CreateQualityCheckInput,
): Promise<QualityCheck> {
  const res = await fetch("/api/checks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return parseError(res);
  return res.json();
}

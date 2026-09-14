import { randomUUID } from "node:crypto";
import type {
  CreateQualityCheckInput,
  QualityCheck,
  QualitySummary,
  QualityStatus,
} from "../shared/types.ts";

const VALID_STATUSES: QualityStatus[] = ["pending", "passed", "failed"];

export class QualityStore {
  private checks: QualityCheck[] = [];

  constructor(seed: CreateQualityCheckInput[] = []) {
    for (const item of seed) {
      this.create(item);
    }
  }

  list(): QualityCheck[] {
    return [...this.checks].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  create(input: CreateQualityCheckInput): QualityCheck {
    const title = input.title?.trim();
    const area = input.area?.trim();

    if (!title) {
      throw new ValidationError("title is required");
    }
    if (!area) {
      throw new ValidationError("area is required");
    }

    const status: QualityStatus = input.status ?? "pending";
    if (!VALID_STATUSES.includes(status)) {
      throw new ValidationError(
        `status must be one of: ${VALID_STATUSES.join(", ")}`,
      );
    }

    const check: QualityCheck = {
      id: randomUUID(),
      title,
      area,
      status,
      notes: input.notes?.trim() ?? "",
      createdAt: new Date().toISOString(),
    };

    this.checks.push(check);
    return check;
  }

  summary(): QualitySummary {
    const total = this.checks.length;
    const passed = this.checks.filter((c) => c.status === "passed").length;
    const failed = this.checks.filter((c) => c.status === "failed").length;
    const pending = this.checks.filter((c) => c.status === "pending").length;
    const passRate = total === 0 ? 0 : Math.round((passed / total) * 100);
    return { total, passed, failed, pending, passRate };
  }
}

export class ValidationError extends Error {}

export const seedData: CreateQualityCheckInput[] = [
  {
    title: "Verificar embalagem do lote 42",
    area: "Embalagem",
    status: "passed",
    notes: "Selo íntegro e rótulo legível.",
  },
  {
    title: "Inspeção visual da solda",
    area: "Produção",
    status: "failed",
    notes: "Porosidade encontrada na peça 7.",
  },
  {
    title: "Calibração da balança analítica",
    area: "Laboratório",
    status: "pending",
    notes: "",
  },
];

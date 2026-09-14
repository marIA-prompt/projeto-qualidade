import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./app.ts";
import { QualityStore } from "./store.ts";

describe("quality API", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(new QualityStore());
  });

  it("reports health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("starts empty", async () => {
    const res = await request(app).get("/api/checks");
    expect(res.status).toBe(200);
    expect(res.body.checks).toEqual([]);
    expect(res.body.summary.total).toBe(0);
  });

  it("creates a quality check and updates the summary", async () => {
    const create = await request(app)
      .post("/api/checks")
      .send({ title: "Teste de vazamento", area: "Produção", status: "passed" });

    expect(create.status).toBe(201);
    expect(create.body.id).toBeTruthy();
    expect(create.body.title).toBe("Teste de vazamento");

    const list = await request(app).get("/api/checks");
    expect(list.body.checks).toHaveLength(1);
    expect(list.body.summary).toMatchObject({ total: 1, passed: 1, passRate: 100 });
  });

  it("rejects a check without a title", async () => {
    const res = await request(app)
      .post("/api/checks")
      .send({ area: "Produção" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it("rejects an invalid status", async () => {
    const res = await request(app)
      .post("/api/checks")
      .send({ title: "x", area: "y", status: "unknown" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/);
  });
});

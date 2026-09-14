import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.tsx";
import type { ChecksResponse } from "./api.ts";
import type { QualityCheck } from "../shared/types.ts";

const emptyResponse: ChecksResponse = {
  checks: [],
  summary: { total: 0, passed: 0, failed: 0, pending: 0, passRate: 0 },
};

function checkFrom(title: string): QualityCheck {
  return {
    id: "test-id",
    title,
    area: "Produção",
    status: "passed",
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state after loading", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(emptyResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    expect(
      await screen.findByText(/Nenhuma verificação registrada ainda/i),
    ).toBeInTheDocument();
  });

  it("submits a new quality check and reloads the list", async () => {
    const created = checkFrom("Inspeção do lote 43");
    const afterCreate: ChecksResponse = {
      checks: [created],
      summary: { total: 1, passed: 1, failed: 0, pending: 0, passRate: 100 },
    };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(created), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(afterCreate), { status: 200 }),
      );

    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/Nenhuma verificação registrada ainda/i);

    await user.type(screen.getByLabelText("Título"), "Inspeção do lote 43");
    await user.type(screen.getByLabelText("Área"), "Produção");
    await user.click(screen.getByRole("button", { name: /Adicionar verificação/i }));

    const list = await screen.findByRole("region", { name: "Verificações" });
    await waitFor(() =>
      expect(within(list).getByText("Inspeção do lote 43")).toBeInTheDocument(),
    );

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      title: "Inspeção do lote 43",
      area: "Produção",
    });
  });
});

import express, { type Express, type Request, type Response } from "express";
import { QualityStore, ValidationError, seedData } from "./store.ts";

export function createApp(store: QualityStore = new QualityStore(seedData)): Express {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/api/checks", (_req: Request, res: Response) => {
    res.json({ checks: store.list(), summary: store.summary() });
  });

  app.post("/api/checks", (req: Request, res: Response) => {
    try {
      const check = store.create(req.body ?? {});
      res.status(201).json(check);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "internal error" });
    }
  });

  app.get("/api/summary", (_req: Request, res: Response) => {
    res.json(store.summary());
  });

  return app;
}

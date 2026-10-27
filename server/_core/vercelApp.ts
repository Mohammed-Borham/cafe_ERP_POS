import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";

const app = express();

// Keep request parsing consistent with the existing Express server.
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Never let an unknown API request fall through to the React application.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default app;

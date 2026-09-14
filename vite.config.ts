import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    environmentMatchGlobs: [
      ["src/**", "jsdom"],
      ["server/**", "node"],
    ],
  },
});

import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { handleLeaderboard, leaderboardPath } from "./src/save/leaderboardApi";

function leaderboardPlugin(): Plugin {
  const file = leaderboardPath();
  const attach = (server: { middlewares: { use: (handler: (req: unknown, res: unknown, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => {
      const request = req as { url?: string };
      if (!request.url?.startsWith("/api/leaderboard")) {
        next();
        return;
      }
      void handleLeaderboard(req as Parameters<typeof handleLeaderboard>[0], res as Parameters<typeof handleLeaderboard>[1], file).catch(() => {
        const response = res as { statusCode: number; end: (body?: string) => void };
        response.statusCode = 500;
        response.end('{"error":"unavailable"}');
      });
    });
  };
  return {
    name: "chemball-leaderboard",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [react(), leaderboardPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

import type { Server } from "node:http";

import { app } from "./app.js";
import {
  connectToDatabase,
  disconnectFromDatabase,
} from "./config/database.js";
import { env } from "./config/env.js";

let httpServer: Server | undefined;
let isShuttingDown = false;

const startServer = async (): Promise<void> => {
  await connectToDatabase();

  httpServer = app.listen(env.PORT, () => {
    console.info(`FundFlow API listening on port ${env.PORT}`);
  });
};

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info(`${signal} received. Shutting down gracefully.`);

  const forceExitTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  if (httpServer) {
    await new Promise<void>((resolve, reject) => {
      httpServer?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  await disconnectFromDatabase();
  clearTimeout(forceExitTimer);
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

startServer().catch((error: unknown) => {
  console.error("Failed to start FundFlow API", error);
  process.exit(1);
});

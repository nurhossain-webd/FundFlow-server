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

  try {
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

      httpServer = undefined;
    }

    await disconnectFromDatabase();
    clearTimeout(forceExitTimer);
    console.info("FundFlow API stopped");
    process.exit(0);
  } catch {
    clearTimeout(forceExitTimer);
    console.error("Failed to complete graceful shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

startServer().catch(() => {
  console.error("FundFlow API failed to start: database connection unavailable");
  process.exit(1);
});

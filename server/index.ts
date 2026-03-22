import express, { type Request, Response, NextFunction } from "express";
import { spawn } from "child_process";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-db";

const app = express();
app.use(express.json({ limit: "10mb" })); // allow large base64 image payloads
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

/** Spawn the Python YOLO detection service as a child process */
function startDetectionService() {
  const python = spawn("python3", ["detection_service.py"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, DETECTION_PORT: "8001" },
  });

  python.stdout.on("data", (data: Buffer) => {
    data.toString().split("\n").filter(Boolean).forEach((line) => {
      console.log(`[detection] ${line}`);
    });
  });

  python.stderr.on("data", (data: Buffer) => {
    data.toString().split("\n").filter(Boolean).forEach((line) => {
      // suppress ultralytics verbose download messages
      if (!line.includes("Downloading") && !line.includes("WARNING")) {
        console.error(`[detection] ${line}`);
      }
    });
  });

  python.on("close", (code) => {
    if (code !== 0) {
      console.warn(`[detection] Service exited (code ${code}). Restarting in 5s...`);
      setTimeout(startDetectionService, 5000);
    }
  });

  python.on("error", (err) => {
    console.warn(`[detection] Failed to start: ${err.message}`);
  });
}

(async () => {
  await initializeDatabase();

  // Start Python YOLO detection service
  startDetectionService();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    console.error("Error:", err);
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();

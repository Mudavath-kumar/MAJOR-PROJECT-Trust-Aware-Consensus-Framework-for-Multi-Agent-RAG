import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/environment.js";
import { maintainDBConnection } from "./config/database.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { isDbConnected } from "./config/database.js";

// Route imports
import authRoutes from "./routes/auth.routes.js";
import documentRoutes from "./routes/document.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import evidenceRoutes from "./routes/evidence.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import { AIService } from "./services/ai.service.js";

const app = express();

// Security and CORS
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins (reflection) for seamless multi-environment frontend deployments
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-user-email",
      "x-user-name",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(globalLimiter);

// Root welcome endpoint
app.get("/", (req, res) => {
  res.json({
    name: "TrustRAG API Server",
    status: "online",
    health: "/api/v1/health",
    version: "1.0.0",
    docs: "https://github.com/Mudavath-kumar/MAJOR-PROJECT-Trust-Aware-Consensus-Framework-for-Multi-Agent-RAG",
  });
});

// Health check endpoint - available at /api/v1/health, /v1/health, and /health
const healthHandler = async (_req: express.Request, res: express.Response) => {
  const aiHealth = await AIService.checkHealth();
  const ready = isDbConnected() && aiHealth.status === "healthy";
  res.json({
    status: ready ? "healthy" : "degraded",
    backend: "online",
    database: isDbConnected() ? "connected" : "offline",
    ready,
    timestamp: new Date().toISOString(),
    ai_service: aiHealth,
  });
};

app.get("/api/v1/health", healthHandler);
app.get("/v1/health", healthHandler);
app.get("/health", healthHandler);

// API Routes - mount on both /api/v1 and /v1 for full client URL compatibility
const apiRoutes: [string, express.Router][] = [
  ["/auth", authRoutes],
  ["/documents", documentRoutes],
  ["/chat", chatRoutes],
  ["/evidence", evidenceRoutes],
  ["/analytics", analyticsRoutes],
  ["/settings", settingsRoutes],
];

for (const [routePath, router] of apiRoutes) {
  app.use(`/api/v1${routePath}`, router);
  app.use(`/v1${routePath}`, router);
}

// Global error handler
app.use(errorHandler);

const PORT = env.PORT || 3001;

// Start server
const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`
🚀 TrustRAG Backend Server is running!
📡 URL: http://localhost:${PORT}
🔗 Health: http://localhost:${PORT}/api/v1/health
⚙️  Environment: ${env.NODE_ENV}
    `);
  });
  void maintainDBConnection();
};

startServer();

export default app;

import express from "express";
import "dotenv/config";
import cors from "cors";
import chatRoutes from "./routes/chat.js";
import { authMiddleware } from "./middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Allowed origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://sigma-gpt-4m1p.vercel.app",
];

// ✅ CORS Configuration (FIXED)
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (origin.endsWith(".vercel.app")) return callback(null, true);
    if (origin.startsWith("http://localhost")) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    console.error(`❌ CORS blocked: ${origin}`);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "x-user-id", // ✅ FIX: allow custom header
  ],
};

// ✅ Apply CORS globally
app.use(cors(corsOptions));



app.use(express.json({ limit: "1mb" }));

// ✅ Protected Routes (NO DUPLICATION)
app.use("/api/chat", authMiddleware, chatRoutes);

// ✅ Health check
app.get(["/", "/health"], (req, res) => {
  res.json({
    status: "SigmaGPT backend running",
    timestamp: new Date().toISOString(),
  });
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("🧠 AI routes active at /api/chat");
});
import express from "express";
import "dotenv/config";
import cors from "cors";
import chatRoutes from "./routes/chat.js";
import { authMiddleware } from "./middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Allowed origins list
const allowedOrigins = [
  "http://localhost:5173",              // local dev
  "http://localhost:4173",              // vite preview
  "https://sigma-gpt-4m1p.vercel.app", // your Vercel URL
];

// ✅ Fixed CORS — supports multiple origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, mobile apps)
    if (!origin) return callback(null, true);

    // Allow any Vercel preview URL automatically
    if (origin.endsWith(".vercel.app")) return callback(null, true);

    // Allow localhost with any port (for dev)
    if (origin.startsWith("http://localhost")) return callback(null, true);

    // Allow exact matches from list
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Block everything else
    console.error(`❌ CORS blocked: ${origin}`);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
}));

app.use(express.json({ limit: "1mb" }));

// Stateless AI routes used by the client-side chat manager.
app.use("/api/chat", chatRoutes);
// ✅ Routes
app.use("/api/chat", authMiddleware, chatRoutes);

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
  console.error("Server Error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 SigmaGPT Backend running on port ${PORT}`);
  console.log("🧠 AI proxy ready");
});
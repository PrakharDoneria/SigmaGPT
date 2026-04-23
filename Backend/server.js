import express from "express";
import "dotenv/config";
import cors from "cors";
import chatRoutes from "./routes/chat.js";
import { authMiddleware } from "./middleware/auth.js";

const app  = express();
const PORT = process.env.PORT || 8080;

// ✅ Simple in-memory rate limiter (no extra packages needed!)
const rateLimitMap = new Map();

const rateLimit = (maxRequests, windowMs) => (req, res, next) => {
  const ip  = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const key = `${ip}`;

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, start: now });
    return next();
  }

  const data = rateLimitMap.get(key);

  // Reset window if expired
  if (now - data.start > windowMs) {
    rateLimitMap.set(key, { count: 1, start: now });
    return next();
  }

  // Increment count
  data.count++;

  if (data.count > maxRequests) {
    return res.status(429).json({
      error: "Too many requests. Please slow down!",
      retryAfter: Math.ceil((data.start + windowMs - now) / 1000),
    });
  }

  next();
};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitMap.entries()) {
    if (now - data.start > 60000) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

// ✅ Allowed origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://sigma-gpt-4m1p.vercel.app",
];

// ✅ CORS
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.endsWith(".vercel.app"))          return callback(null, true);
    if (origin.startsWith("http://localhost"))    return callback(null, true);
    if (allowedOrigins.includes(origin))          return callback(null, true);
    console.error(`❌ CORS blocked: ${origin}`);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

// ✅ Rate limits
app.use("/api/chat/chat",    rateLimit(30, 60 * 1000));  // 30 msgs/min per IP
app.use("/api/chat/threads", rateLimit(60, 60 * 1000));  // 60 reads/min per IP
app.use("/api/",             rateLimit(100, 60 * 1000)); // 100 req/min overall

// ✅ Protected routes
app.use("/api/chat", authMiddleware, chatRoutes);

// ✅ Health check
app.get(["/", "/health"], (req, res) => {
  res.json({ status: "✅ SigmaGPT backend running", timestamp: new Date().toISOString() });
});

// ✅ 404
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 SigmaGPT running on port ${PORT}`);
  console.log(`🔒 Rate limiting enabled`);
});
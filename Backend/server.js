import express from "express";
import "dotenv/config";
import cors from "cors";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import chatRoutes from "./routes/chat.js";

// ✅ Validate ENV early (fail fast)
if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  throw new Error("❌ Missing Firebase environment variables");
}

// ✅ Firebase config using ENV (no JSON file)
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
};

// ✅ Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
});

// ✅ Firestore
export const db = getFirestore();

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

// ✅ Middlewares
app.use(express.json());

// ✅ Routes
app.use("/api/chat", chatRoutes);

// ✅ Health check (Render uses this)
app.get("/", (req, res) => {
  res.json({
    status: "✅ SigmaGPT Backend Running!",
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
  console.log(`🔥 Firebase Firestore connected!`);
});
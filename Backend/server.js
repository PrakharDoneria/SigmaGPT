import express from "express";
import "dotenv/config";
import cors from "cors";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";
import chatRoutes from "./routes/chat.js";

// ✅ Load service account key
const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccountKey.json");

// ✅ Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
});

// ✅ Initialize Firestore and export it
export const db = getFirestore();

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Middlewares
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "DELETE", "PUT"],
  credentials: true,
}));

// ✅ Routes
app.use("/api/chat", chatRoutes);

// ✅ Health check — needed for Render deployment
app.get("/", (req, res) => {
  res.json({
    status: "✅ SigmaGPT Backend Running!",
    database: "Firebase Firestore",
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
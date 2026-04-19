import express from "express";
import { db } from "../server.js";
import {
  getChatResponse,
  getChatResponseStream,
  generateChatTitle,
} from "../utils/groq.js"; // ✅ uses openai package — no groq-sdk needed!

const router = express.Router();

// ═══════════════════════════════════════
// GET all threads
// ═══════════════════════════════════════
router.get("/threads", async (req, res) => {
  try {
    const snapshot = await db
      .collection("threads")
      .orderBy("updatedAt", "desc")
      .get();

    const threads = [];
    snapshot.forEach((doc) => {
      threads.push({ threadId: doc.id, ...doc.data() });
    });

    res.json(threads);
  } catch (error) {
    console.error("❌ Failed to fetch threads:", error.message);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

// ═══════════════════════════════════════
// GET single thread with messages
// ═══════════════════════════════════════
router.get("/threads/:threadId", async (req, res) => {
  try {
    const { threadId } = req.params;
    const threadDoc = await db.collection("threads").doc(threadId).get();

    if (!threadDoc.exists) {
      return res.status(404).json({ error: "Thread not found" });
    }

    // Get messages from subcollection
    const messagesSnapshot = await db
      .collection("threads")
      .doc(threadId)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .get();

    const messages = [];
    messagesSnapshot.forEach((doc) => messages.push(doc.data()));

    res.json({ threadId, ...threadDoc.data(), messages });
  } catch (error) {
    console.error("❌ Failed to fetch thread:", error.message);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// ═══════════════════════════════════════
// POST — Send message (streaming)
// ═══════════════════════════════════════
router.post("/chat", async (req, res) => {
  try {
    const { message, threadId, persona = "general", model = "smart" } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // ✅ Streaming headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let currentThreadId = threadId;

    // ✅ Create new thread if needed
    if (!currentThreadId) {
      const newThreadRef = db.collection("threads").doc();
      currentThreadId = newThreadRef.id;
      const title = await generateChatTitle(message);
      await newThreadRef.set({
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pinned: false,
        persona,
        model,
      });
    } else {
      // Check if thread exists, create if not
      const threadDoc = await db.collection("threads").doc(currentThreadId).get();
      if (!threadDoc.exists) {
        const title = await generateChatTitle(message);
        await db.collection("threads").doc(currentThreadId).set({
          title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pinned: false,
          persona,
          model,
        });
      }
    }

    // ✅ Save user message
    await db
      .collection("threads")
      .doc(currentThreadId)
      .collection("messages")
      .add({
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      });

    // ✅ Get conversation history
    const messagesSnapshot = await db
      .collection("threads")
      .doc(currentThreadId)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .get();

    const history = [];
    messagesSnapshot.forEach((doc) => {
      const data = doc.data();
      history.push({ role: data.role, content: data.content });
    });

    // ✅ Stream response using groq.js (openai SDK)
    let fullResponse = "";

    await getChatResponseStream(
      history,
      persona,
      model,
      (chunk) => {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    );

    // ✅ Save assistant message
    await db
      .collection("threads")
      .doc(currentThreadId)
      .collection("messages")
      .add({
        role: "assistant",
        content: fullResponse,
        timestamp: new Date().toISOString(),
        persona,
      });

    // ✅ Update thread timestamp
    await db.collection("threads").doc(currentThreadId).update({
      updatedAt: new Date().toISOString(),
    });

    // ✅ Done signal
    res.write(`data: ${JSON.stringify({ done: true, threadId: currentThreadId })}\n\n`);
    res.end();

  } catch (error) {
    console.error("❌ Chat error:", error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// ═══════════════════════════════════════
// PUT — Rename thread
// ═══════════════════════════════════════
router.put("/threads/:threadId/rename", async (req, res) => {
  try {
    const { threadId } = req.params;
    const { title } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const threadRef = db.collection("threads").doc(threadId);
    const threadDoc = await threadRef.get();

    if (!threadDoc.exists) {
      return res.status(404).json({ error: "Thread not found" });
    }

    await threadRef.update({ title: title.trim() });
    res.json({ success: true, title: title.trim() });

  } catch (error) {
    console.error("❌ Rename error:", error.message);
    res.status(500).json({ error: "Failed to rename thread" });
  }
});

// ═══════════════════════════════════════
// PUT — Pin/Unpin thread
// ═══════════════════════════════════════
router.put("/threads/:threadId/pin", async (req, res) => {
  try {
    const { threadId } = req.params;
    const threadRef = db.collection("threads").doc(threadId);
    const threadDoc = await threadRef.get();

    if (!threadDoc.exists) {
      return res.status(404).json({ error: "Thread not found" });
    }

    const newPinned = !threadDoc.data().pinned;
    await threadRef.update({ pinned: newPinned });
    res.json({ success: true, pinned: newPinned });

  } catch (error) {
    console.error("❌ Pin error:", error.message);
    res.status(500).json({ error: "Failed to pin thread" });
  }
});

// ═══════════════════════════════════════
// DELETE — Single thread
// ═══════════════════════════════════════
router.delete("/threads/:threadId", async (req, res) => {
  try {
    const { threadId } = req.params;

    // Delete messages subcollection first
    const messagesRef = db.collection("threads").doc(threadId).collection("messages");
    const messagesSnapshot = await messagesRef.get();
    const batch = db.batch();
    messagesSnapshot.forEach((doc) => batch.delete(doc.ref));
    batch.delete(db.collection("threads").doc(threadId));
    await batch.commit();

    res.json({ success: true, message: "Thread deleted" });
  } catch (error) {
    console.error("❌ Delete error:", error.message);
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

// ═══════════════════════════════════════
// DELETE — All threads
// ═══════════════════════════════════════
router.delete("/threads", async (req, res) => {
  try {
    const snapshot = await db.collection("threads").get();
    const batch = db.batch();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true, message: "All threads cleared" });
  } catch (error) {
    console.error("❌ Clear error:", error.message);
    res.status(500).json({ error: "Failed to clear threads" });
  }
});

export default rou
import express from "express";
import { db } from "../server.js";
import {
  getChatResponse,
  getChatResponseStream,
  generateChatTitle,
} from "../utils/groq.js";

const router = express.Router();

// ✅ Helper — format thread doc for frontend
const formatThread = (doc) => ({
  threadId: doc.id,
  ...doc.data(),
});

// ✅ GET all threads — sorted by updatedAt descending
router.get("/threads", async (req, res) => {
  try {
    const snapshot = await db
      .collection("threads")
      .orderBy("pinned", "desc")
      .orderBy("updatedAt", "desc")
      .get();

    const threads = snapshot.docs.map((doc) => ({
      threadId: doc.id,
      title: doc.data().title || "New Chat",
      pinned: doc.data().pinned || false,
      persona: doc.data().persona || "general",
      model: doc.data().model || "smart",
      messageCount: doc.data().messageCount || 0,
      createdAt: doc.data().createdAt || null,
      updatedAt: doc.data().updatedAt || null,
    }));

    res.json(threads);
  } catch (err) {
    console.error("❌ Failed to fetch threads:", err.message);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

// ✅ GET single thread with all messages
router.get("/threads/:threadId", async (req, res) => {
  const { threadId } = req.params;

  try {
    const doc = await db.collection("threads").doc(threadId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json({ threadId: doc.id, ...doc.data() });
  } catch (err) {
    console.error("❌ Failed to fetch thread:", err.message);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// ✅ POST — Send message (with streaming)
router.post("/chat", async (req, res) => {
  const { threadId, message, persona = "general", model = "smart" } = req.body;

  if (!threadId || !message) {
    return res.status(400).json({ error: "threadId and message are required" });
  }

  try {
    const threadRef = db.collection("threads").doc(threadId);
    const threadDoc = await threadRef.get();

    const now = new Date().toISOString();
    const userMessage = {
      role: "user",
      content: message,
      timestamp: now,
    };

    let messages = [];

    if (!threadDoc.exists) {
      // ✅ Create new thread
      const title = await generateChatTitle(message);
      await threadRef.set({
        title,
        persona,
        model,
        pinned: false,
        messages: [userMessage],
        messageCount: 1,
        createdAt: now,
        updatedAt: now,
      });
      messages = [userMessage];
    } else {
      // ✅ Add to existing thread
      messages = [...(threadDoc.data().messages || []), userMessage];
      await threadRef.update({
        messages,
        updatedAt: now,
      });
    }

    // Format messages for Groq
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // ✅ Check if client wants streaming
    const wantsStream = req.headers["accept"] === "text/event-stream";

    if (wantsStream) {
      // ✅ Streaming mode
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullReply = "";

      const result = await getChatResponseStream(
        formattedMessages,
        persona,
        model,
        (chunk) => {
          fullReply += chunk;
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
      );

      // ✅ Save assistant reply to Firestore
      const assistantMessage = {
        role: "assistant",
        content: result.content,
        persona: result.persona,
        model: result.model,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...messages, assistantMessage];
      await threadRef.update({
        messages: updatedMessages,
        messageCount: updatedMessages.length,
        updatedAt: new Date().toISOString(),
      });

      res.write(`data: ${JSON.stringify({ done: true, threadId })}\n\n`);
      res.end();

    } else {
      // ✅ Normal mode
      const result = await getChatResponse(formattedMessages, persona, model);

      const assistantMessage = {
        role: "assistant",
        content: result.content,
        persona: result.persona,
        model: result.model,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...messages, assistantMessage];
      await threadRef.update({
        messages: updatedMessages,
        messageCount: updatedMessages.length,
        updatedAt: new Date().toISOString(),
      });

      res.json({
        reply: result.content,
        persona: result.persona,
        model: result.model,
        tokens: result.tokens,
        threadId,
      });
    }

  } catch (err) {
    console.error("❌ Chat error:", err.message);
    res.status(500).json({ error: "Failed to get AI response. Try again." });
  }
});

// ✅ PUT — Rename a thread
router.put("/threads/:threadId/rename", async (req, res) => {
  const { threadId } = req.params;
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    await db.collection("threads").doc(threadId).update({
      title: title.trim(),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, title: title.trim() });
  } catch (err) {
    console.error("❌ Rename error:", err.message);
    res.status(500).json({ error: "Failed to rename thread" });
  }
});

// ✅ PUT — Pin/Unpin a thread
router.put("/threads/:threadId/pin", async (req, res) => {
  const { threadId } = req.params;

  try {
    const doc = await db.collection("threads").doc(threadId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Thread not found" });
    }

    const newPinned = !doc.data().pinned;
    await db.collection("threads").doc(threadId).update({
      pinned: newPinned,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, pinned: newPinned });
  } catch (err) {
    console.error("❌ Pin error:", err.message);
    res.status(500).json({ error: "Failed to pin thread" });
  }
});

// ✅ DELETE — Delete single thread
router.delete("/threads/:threadId", async (req, res) => {
  const { threadId } = req.params;

  try {
    const doc = await db.collection("threads").doc(threadId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Thread not found" });
    }

    await db.collection("threads").doc(threadId).delete();
    res.json({ success: true, message: "Thread deleted successfully" });
  } catch (err) {
    console.error("❌ Delete error:", err.message);
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

// ✅ DELETE — Clear ALL threads
router.delete("/threads", async (req, res) => {
  try {
    const snapshot = await db.collection("threads").get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true, message: "All threads cleared" });
  } catch (err) {
    console.error("❌ Clear error:", err.message);
    res.status(500).json({ error: "Failed to clear threads" });
  }
});

export default router;
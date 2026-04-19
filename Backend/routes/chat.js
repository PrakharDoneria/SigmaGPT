// routes/chat.js
import express from "express";
import { db } from "../server.js"; // Import Firestore
import Groq from "groq-sdk";

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ═══════════════════════════════════════════════════════════
// THREADS ROUTES
// ═══════════════════════════════════════════════════════════

// GET /api/chat/threads - Get all threads
router.get("/threads", async (req, res) => {
  try {
    const threadsRef = db.collection("threads");
    const snapshot = await threadsRef.orderBy("updatedAt", "desc").get();

    const threads = [];
    snapshot.forEach((doc) => {
      threads.push({
        threadId: doc.id,
        ...doc.data(),
      });
    });

    res.json(threads);
  } catch (error) {
    console.error("Error fetching threads:", error);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

// GET /api/chat/threads/:threadId - Get single thread with messages
router.get("/threads/:threadId", async (req, res) => {
  try {
    const { threadId } = req.params;

    const threadDoc = await db.collection("threads").doc(threadId).get();

    if (!threadDoc.exists) {
      return res.status(404).json({ error: "Thread not found" });
    }

    const messagesSnapshot = await db
      .collection("threads")
      .doc(threadId)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .get();

    const messages = [];
    messagesSnapshot.forEach((doc) => {
      messages.push(doc.data());
    });

    res.json({
      ...threadDoc.data(),
      messages,
    });
  } catch (error) {
    console.error("Error fetching thread:", error);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// DELETE /api/chat/threads/:threadId - Delete a thread
router.delete("/threads/:threadId", async (req, res) => {
  try {
    const { threadId } = req.params;

    // Delete messages subcollection
    const messagesRef = db
      .collection("threads")
      .doc(threadId)
      .collection("messages");
    const messagesSnapshot = await messagesRef.get();

    const batch = db.batch();
    messagesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete thread document
    batch.delete(db.collection("threads").doc(threadId));

    await batch.commit();

    res.json({ success: true, message: "Thread deleted" });
  } catch (error) {
    console.error("Error deleting thread:", error);
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

// PUT /api/chat/threads/:threadId/pin - Toggle pin status
router.put("/threads/:threadId/pin", async (req, res) => {
  try {
    const { threadId } = req.params;

    const threadRef = db.collection("threads").doc(threadId);
    const threadDoc = await threadRef.get();

    if (!threadDoc.exists) {
      return res.status(404).json({ error: "Thread not found" });
    }

    const currentPinned = threadDoc.data().pinned || false;
    await threadRef.update({ pinned: !currentPinned });

    res.json({ pinned: !currentPinned });
  } catch (error) {
    console.error("Error toggling pin:", error);
    res.status(500).json({ error: "Failed to toggle pin" });
  }
});

// PUT /api/chat/threads/:threadId/rename - Rename thread
router.put("/threads/:threadId/rename", async (req, res) => {
  try {
    const { threadId } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
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
    console.error("Error renaming thread:", error);
    res.status(500).json({ error: "Failed to rename thread" });
  }
});

// DELETE /api/chat/threads - Clear all threads
router.delete("/threads", async (req, res) => {
  try {
    const threadsRef = db.collection("threads");
    const snapshot = await threadsRef.get();

    const batch = db.batch();
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    res.json({ success: true, message: "All threads cleared" });
  } catch (error) {
    console.error("Error clearing threads:", error);
    res.status(500).json({ error: "Failed to clear threads" });
  }
});

// ═══════════════════════════════════════════════════════════
// CHAT ROUTE (with streaming)
// ═══════════════════════════════════════════════════════════

// POST /api/chat - Send message and get streaming response
router.post("/", async (req, res) => {
  try {
    const { message, threadId, persona, model } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Set up SSE headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let currentThreadId = threadId;

    // Create new thread if needed
    if (!currentThreadId) {
      const newThreadRef = db.collection("threads").doc();
      currentThreadId = newThreadRef.id;

      await newThreadRef.set({
        title: message.slice(0, 50),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pinned: false,
      });
    }

    // Save user message
    const userMsgRef = db
      .collection("threads")
      .doc(currentThreadId)
      .collection("messages")
      .doc();

    await userMsgRef.set({
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Get conversation history
    const messagesSnapshot = await db
      .collection("threads")
      .doc(currentThreadId)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .get();

    const history = [];
    messagesSnapshot.forEach((doc) => {
      const data = doc.data();
      history.push({
        role: data.role,
        content: data.content,
      });
    });

    // Get Groq streaming response
    const stream = await groq.chat.completions.create({
      messages: history,
      model: "llama-3.3-70b-versatile",
      stream: true,
    });

    let fullResponse = "";

    // Stream chunks to client
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
      }
    }

    // Save assistant response
    const assistantMsgRef = db
      .collection("threads")
      .doc(currentThreadId)
      .collection("messages")
      .doc();

    await assistantMsgRef.set({
      role: "assistant",
      content: fullResponse,
      timestamp: new Date().toISOString(),
      persona: persona || "general",
    });

    // Update thread timestamp
    await db.collection("threads").doc(currentThreadId).update({
      updatedAt: new Date().toISOString(),
    });

    // Send done signal
    res.write(`data: ${JSON.stringify({ done: true, threadId: currentThreadId })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

export default router;